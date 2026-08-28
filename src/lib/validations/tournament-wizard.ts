import { z } from "zod";
import { isValidEntryTeamCount } from "@/lib/services/bracket-engine";
import { isObaDePresetKey } from "@/lib/brackets/oba-de-presets";

export const WIZARD_MAX_TEAMS_PER_POOL = 24;
export const WIZARD_MAX_POOLS_PER_DIVISION = 8;
export const WIZARD_MAX_DIVISIONS = 8;
export const WIZARD_MAX_TEAMS_TOURNAMENT = 96;
export const WIZARD_MAX_TEAMS_PER_DIVISION = 64;
/** Default team count for the first division in the create wizard. */
export const WIZARD_DEFAULT_TEAMS_PER_DIVISION = 8;
/** Default when adding an extra division. */
export const WIZARD_DEFAULT_TEAMS_EXTRA_DIVISION = 4;

const namedList = (fallbackPrefix: string) =>
  z
    .object({
      count: z.coerce.number().int().min(1).max(WIZARD_MAX_TEAMS_TOURNAMENT),
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

const formatPresetSchema = z.enum([
  "single_elim_classic",
  "double_elim_classic",
  "oba_de_4",
  "oba_de_5",
  "oba_de_6",
  "oba_de_7",
  "oba_de_13",
  "custom",
]);

const divisionBracketSchema = z.object({
  name: z.string().trim().min(1).max(120),
  teamNames: z
    .array(z.string().trim().min(1).max(120))
    .min(2)
    .max(WIZARD_MAX_TEAMS_PER_DIVISION),
  /** Named wizard format (classic SE/DE, OBA DE 4–7, or custom). */
  formatPreset: formatPresetSchema.default("single_elim_classic"),
  bracketFormat: z.enum(["SINGLE_ELIMINATION", "DOUBLE_ELIMINATION"]),
  /** template = create bracket now; custom = teams only, build bracket later */
  buildMode: z.enum(["template", "custom"]),
  entrySize: z.coerce.number().int().min(2).max(64),
  seedMode: z.enum(["auto", "manual"]),
  /** Length = entrySize when seedMode is manual (null → bye). */
  firstRoundOrder: z.array(z.string().trim().min(1).max(120).nullable()).optional(),
});

export const tournamentWizardSchema = z
  .object({
    tournamentName: z.string().trim().min(1, "Tournament name is required").max(200),
    format: z.enum(["round_robin", "bracket_only"]),
    /** Display metadata only — nested RR/bracket payloads own the real structure. */
    divisions: namedList("Division"),
    teams: namedList("Team"),
    roundRobin: z
      .object({
        divisions: z.array(divisionRoundRobinSchema).min(1).max(WIZARD_MAX_DIVISIONS),
      })
      .optional(),
    bracket: z
      .object({
        divisions: z.array(divisionBracketSchema).min(1).max(WIZARD_MAX_DIVISIONS),
      })
      .optional(),
  })
  .superRefine((d, ctx) => {
    if (d.format === "round_robin") {
      if (!d.roundRobin?.divisions?.length) {
        ctx.addIssue({
          code: "custom",
          message: "Assign teams into pools for each division.",
          path: ["roundRobin"],
        });
        return;
      }
      if (d.roundRobin.divisions.length !== d.divisions.count) {
        ctx.addIssue({
          code: "custom",
          message: "Division count must match round-robin divisions.",
          path: ["roundRobin", "divisions"],
        });
      }
      let totalTeams = 0;
      for (let di = 0; di < d.roundRobin.divisions.length; di++) {
        const div = d.roundRobin.divisions[di]!;
        const names: string[] = [];
        for (let pi = 0; pi < div.pools.length; pi++) {
          const pool = div.pools[pi]!;
          if (pool.teamNames.length === 0) {
            ctx.addIssue({
              code: "custom",
              message: `${div.name}: pool “${pool.name}” is empty — remove it or add teams.`,
              path: ["roundRobin", "divisions", di, "pools", pi],
            });
          }
          for (const n of pool.teamNames) names.push(n);
        }
        totalTeams += names.length;
        if (names.length === 0) {
          ctx.addIssue({
            code: "custom",
            message: `${div.name} has no teams placed in pools.`,
            path: ["roundRobin", "divisions", di],
          });
        }
        if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) {
          ctx.addIssue({
            code: "custom",
            message: `${div.name}: team names must be unique within the division.`,
            path: ["roundRobin", "divisions", di],
          });
        }
      }
      if (totalTeams > WIZARD_MAX_TEAMS_TOURNAMENT) {
        ctx.addIssue({
          code: "custom",
          message: `At most ${WIZARD_MAX_TEAMS_TOURNAMENT} teams.`,
          path: ["teams"],
        });
      }
      return;
    }

    if (!d.bracket?.divisions?.length) {
      ctx.addIssue({
        code: "custom",
        message: "Configure a bracket for each division.",
        path: ["bracket"],
      });
      return;
    }
    if (d.bracket.divisions.length !== d.divisions.count) {
      ctx.addIssue({
        code: "custom",
        message: "Division count must match bracket divisions.",
        path: ["bracket", "divisions"],
      });
    }
    let totalTeams = 0;
    for (let di = 0; di < d.bracket.divisions.length; di++) {
      const div = d.bracket.divisions[di]!;
      totalTeams += div.teamNames.length;
      if (new Set(div.teamNames.map((n) => n.toLowerCase())).size !== div.teamNames.length) {
        ctx.addIssue({
          code: "custom",
          message: `${div.name}: team names must be unique within the division.`,
          path: ["bracket", "divisions", di, "teamNames"],
        });
      }
      if (div.formatPreset === "custom" || div.buildMode === "custom") continue;

      if (isObaDePresetKey(div.formatPreset)) {
        const need = Number(div.formatPreset.replace("oba_de_", ""));
        if (div.teamNames.length !== need) {
          ctx.addIssue({
            code: "custom",
            message: `${div.name}: ${div.formatPreset} requires exactly ${need} teams (have ${div.teamNames.length}).`,
            path: ["bracket", "divisions", di, "formatPreset"],
          });
        }
        if (div.bracketFormat !== "DOUBLE_ELIMINATION") {
          ctx.addIssue({
            code: "custom",
            message: `${div.name}: OBA presets are double elimination.`,
            path: ["bracket", "divisions", di, "bracketFormat"],
          });
        }
        continue;
      }

      if (!isValidEntryTeamCount(div.entrySize)) {
        ctx.addIssue({
          code: "custom",
          message: `${div.name}: bracket size must be a power of 2 between 2 and 64.`,
          path: ["bracket", "divisions", di, "entrySize"],
        });
      }
      if (div.entrySize < div.teamNames.length) {
        ctx.addIssue({
          code: "custom",
          message: `${div.name}: bracket size (${div.entrySize}) is smaller than team count (${div.teamNames.length}).`,
          path: ["bracket", "divisions", di, "entrySize"],
        });
      }
      if (div.seedMode === "manual") {
        if (!div.firstRoundOrder || div.firstRoundOrder.length !== div.entrySize) {
          ctx.addIssue({
            code: "custom",
            message: `${div.name}: manual seeding must list ${div.entrySize} seed slots.`,
            path: ["bracket", "divisions", di, "firstRoundOrder"],
          });
        } else {
          const placed = div.firstRoundOrder.filter((x): x is string => x != null && x.trim() !== "");
          if (new Set(placed.map((n) => n.toLowerCase())).size !== placed.length) {
            ctx.addIssue({
              code: "custom",
              message: `${div.name}: each team can only appear once in Round 1 seeds.`,
              path: ["bracket", "divisions", di, "firstRoundOrder"],
            });
          }
          const teamSet = new Set(div.teamNames.map((n) => n.toLowerCase()));
          for (const p of placed) {
            if (!teamSet.has(p.toLowerCase())) {
              ctx.addIssue({
                code: "custom",
                message: `${div.name}: seed refers to unknown team “${p}”.`,
                path: ["bracket", "divisions", di, "firstRoundOrder"],
              });
              break;
            }
          }
        }
      }
    }
    if (totalTeams > WIZARD_MAX_TEAMS_TOURNAMENT) {
      ctx.addIssue({
        code: "custom",
        message: `At most ${WIZARD_MAX_TEAMS_TOURNAMENT} teams.`,
        path: ["teams"],
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
} as const;

export function todayYmdInTimeZone(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    /* fall through */
  }
  return todayYmdUtc();
}

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
