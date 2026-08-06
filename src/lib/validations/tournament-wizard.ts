import { z } from "zod";

export const WIZARD_MAX_TEAMS_PER_POOL = 24;
export const WIZARD_MAX_POOLS_PER_DIVISION = 8;
export const WIZARD_MAX_DIVISIONS = 8;
export const WIZARD_MAX_TEAMS_TOURNAMENT = 96;

const namedList = (fallbackPrefix: string) =>
  z
    .object({
      count: z.coerce.number().int().min(1).max(WIZARD_MAX_TEAMS_TOURNAMENT),
      /** Empty / short → generate `${fallbackPrefix}1`… */
      names: z.array(z.string().trim().max(120)).optional(),
      skipNaming: z.boolean().optional().default(false),
    })
    .transform((d) => {
      const names: string[] = [];
      if (d.skipNaming) {
        for (let i = 0; i < d.count; i++) names.push(`${fallbackPrefix}${i + 1}`);
        return { count: d.count, names, skipNaming: true as const };
      }
      const raw = d.names ?? [];
      for (let i = 0; i < d.count; i++) {
        const n = (raw[i] ?? "").trim();
        names.push(n || `${fallbackPrefix}${i + 1}`);
      }
      return { count: d.count, names, skipNaming: false as const };
    });

const poolAssignmentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  teamNames: z.array(z.string().trim().min(1).max(120)).max(WIZARD_MAX_TEAMS_PER_POOL),
  teamsAdvancing: z.coerce.number().int().min(0).max(WIZARD_MAX_TEAMS_PER_POOL).default(0),
});

const divisionRoundRobinSchema = z.object({
  name: z.string().trim().min(1).max(120),
  pools: z
    .array(poolAssignmentSchema)
    .min(1)
    .max(WIZARD_MAX_POOLS_PER_DIVISION),
});

const firstRoundSideSchema = z.union([
  z.object({ bye: z.literal(true) }),
  z.object({ teamName: z.string().trim().min(1).max(120) }),
]);

const divisionBracketSchema = z.object({
  name: z.string().trim().min(1).max(120),
  teamNames: z.array(z.string().trim().min(1).max(120)).min(2).max(64),
  bracketFormat: z.enum(["SINGLE_ELIMINATION", "DOUBLE_ELIMINATION"]),
  /** template = classic power-of-2 tree; custom = create empty tree for later editing */
  buildMode: z.enum(["template", "custom"]),
  entrySize: z.coerce.number().int().min(2).max(64),
  seedMode: z.enum(["auto", "manual"]),
  /** Length = entrySize when seedMode is manual (null/missing → bye). */
  firstRoundOrder: z.array(z.string().trim().min(1).max(120).nullable()).optional(),
});

export const tournamentWizardSchema = z
  .object({
    tournamentName: z.string().trim().min(1, "Tournament name is required").max(200),
    format: z.enum(["round_robin", "bracket_only"]),
    divisions: namedList("Division"),
    teams: namedList("Team"),
    /** Round-robin finish: pools + team placement. */
    roundRobin: z
      .object({
        divisions: z.array(divisionRoundRobinSchema).min(1).max(WIZARD_MAX_DIVISIONS),
      })
      .optional(),
    /** Bracket-only finish. */
    bracket: z
      .object({
        divisions: z.array(divisionBracketSchema).min(1).max(WIZARD_MAX_DIVISIONS),
      })
      .optional(),
  })
  .superRefine((d, ctx) => {
    if (d.teams.count > WIZARD_MAX_TEAMS_TOURNAMENT) {
      ctx.addIssue({
        code: "custom",
        message: `At most ${WIZARD_MAX_TEAMS_TOURNAMENT} teams.`,
        path: ["teams"],
      });
    }
    if (d.format === "round_robin") {
      if (!d.roundRobin?.divisions?.length) {
        ctx.addIssue({
          code: "custom",
          message: "Assign teams into pools for each division.",
          path: ["roundRobin"],
        });
      }
    } else if (!d.bracket?.divisions?.length) {
      ctx.addIssue({
        code: "custom",
        message: "Configure a bracket for each division.",
        path: ["bracket"],
      });
    }
  });

export type TournamentWizardInput = z.infer<typeof tournamentWizardSchema>;

/** Defaults applied server-side (venue / schedule deferred to post-create settings). */
export const WIZARD_DEFAULTS = {
  venueName: "TBD",
  venueAddress: "TBD",
  timezone: "America/New_York",
  fieldCount: 1,
  slotMinutes: 90,
  gameDurationMinutes: 75,
  minRestMinutes: 30,
  travelMinutesBetweenFields: 10,
  dayStartTime: "08:00",
  dayEndTime: "20:00",
} as const;

export function todayYmdUtc(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function plusDaysYmdUtc(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function nextPowerOfTwoAtLeast(n: number): number {
  let p = 2;
  while (p < n) p *= 2;
  return Math.min(p, 64);
}
