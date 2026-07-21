import { z } from "zod";

export const WIZARD_MAX_TEAMS_PER_POOL = 24;
export const WIZARD_MAX_POOLS_PER_DIVISION = 8;
export const WIZARD_MAX_DIVISIONS = 8;
export const WIZARD_MAX_TEAMS_TOURNAMENT = 96;

const poolRowSchema = z
  .object({
    name: z.string().trim().min(1, "Pool name is required").max(120),
    teamsAdvancing: z.coerce.number().int().min(0).max(WIZARD_MAX_TEAMS_PER_POOL),
    /** When true, create Team 1…N placeholders instead of named teams. */
    usePlaceholders: z.boolean(),
    /** Required when usePlaceholders is true. */
    teamCount: z.coerce.number().int().min(1).max(WIZARD_MAX_TEAMS_PER_POOL).optional(),
    /** One name per team when usePlaceholders is false. */
    teamNames: z.array(z.string().trim().min(1).max(120)).max(WIZARD_MAX_TEAMS_PER_POOL).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.usePlaceholders) {
      const count = d.teamCount ?? 0;
      if (count < 1) {
        ctx.addIssue({
          code: "custom",
          message: "Placeholder team count must be at least 1",
          path: ["teamCount"],
        });
      }
      if (d.teamsAdvancing > count) {
        ctx.addIssue({
          code: "custom",
          message: "Teams advancing cannot exceed team count",
          path: ["teamsAdvancing"],
        });
      }
      return;
    }
    const names = (d.teamNames ?? []).map((n) => n.trim()).filter(Boolean);
    if (names.length < 1) {
      ctx.addIssue({
        code: "custom",
        message: "Paste at least one team name, or use placeholders",
        path: ["teamNames"],
      });
    }
    if (d.teamsAdvancing > names.length) {
      ctx.addIssue({
        code: "custom",
        message: "Teams advancing cannot exceed number of team names",
        path: ["teamsAdvancing"],
      });
    }
  });

const divisionSchema = z.object({
  name: z.string().trim().min(1, "Division name is required").max(120),
  pools: z
    .array(poolRowSchema)
    .min(1, "Each division needs at least one pool")
    .max(WIZARD_MAX_POOLS_PER_DIVISION, `At most ${WIZARD_MAX_POOLS_PER_DIVISION} pools per division`),
});

export const tournamentWizardSchema = z
  .object({
    tournamentName: z.string().trim().min(1, "Tournament name is required").max(200),
    venueName: z.string().trim().min(1, "Venue name is required").max(200),
    venueAddress: z.string().trim().min(1, "Address is required").max(10_000),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    timezone: z.string().trim().min(1).max(120),
    divisions: z
      .array(divisionSchema)
      .min(1, "At least one division is required")
      .max(WIZARD_MAX_DIVISIONS, `At most ${WIZARD_MAX_DIVISIONS} divisions`),
    /** After skeleton create: generate pool RR for pools with ≥2 teams. */
    generateSchedules: z.boolean().optional().default(false),
    /** After skeleton create: single-elim when advancing totals are a power of 2. */
    createBrackets: z.boolean().optional().default(false),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  })
  .superRefine((d, ctx) => {
    let totalTeams = 0;
    for (const div of d.divisions) {
      for (const pool of div.pools) {
        if (pool.usePlaceholders) {
          totalTeams += pool.teamCount ?? 0;
        } else {
          totalTeams += (pool.teamNames ?? []).filter((n) => n.trim()).length;
        }
      }
    }
    if (totalTeams > WIZARD_MAX_TEAMS_TOURNAMENT) {
      ctx.addIssue({
        code: "custom",
        message: `At most ${WIZARD_MAX_TEAMS_TOURNAMENT} teams per tournament (got ${totalTeams}). Split into more events or fewer teams.`,
        path: ["divisions"],
      });
    }
  });

export type TournamentWizardInput = z.infer<typeof tournamentWizardSchema>;

/** Resolved team count for a pool row after validation. */
export function wizardPoolTeamCount(pool: TournamentWizardInput["divisions"][0]["pools"][0]): number {
  if (pool.usePlaceholders) return pool.teamCount ?? 0;
  return (pool.teamNames ?? []).map((n) => n.trim()).filter(Boolean).length;
}
