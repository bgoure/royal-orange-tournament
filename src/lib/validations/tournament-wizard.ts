import { z } from "zod";

export const WIZARD_MAX_TEAMS_PER_POOL = 24;
export const WIZARD_MAX_POOLS_PER_DIVISION = 8;
export const WIZARD_MAX_DIVISIONS = 8;
export const WIZARD_MAX_TEAMS_TOURNAMENT = 96;
export const WIZARD_MAX_FIELDS = 16;

const hmSchema = z
  .string()
  .trim()
  .regex(/^\d{2}:\d{2}$/, "Use HH:mm");

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
    /** Number of fields to create at HQ (Field 1…N). */
    fieldCount: z.coerce.number().int().min(1).max(WIZARD_MAX_FIELDS),
    /** Minutes between game start waves (slot / changeover cadence). */
    slotMinutes: z.coerce.number().int().min(15).max(360),
    /** How long each game lasts (field + team occupied). */
    gameDurationMinutes: z.coerce.number().int().min(15).max(360),
    /** Break after a game ends before that team may start another. */
    minRestMinutes: z.coerce.number().int().min(0).max(240),
    /** Extra travel minutes when a team's next game is on a different field. */
    travelMinutesBetweenFields: z.coerce.number().int().min(0).max(120),
    /**
     * Optional N×N travel matrix (minutes). When set, length must equal fieldCount;
     * `matrix[i][j]` is travel from Field i+1 to Field j+1. Missing/invalid cells fall back to uniform travel.
     */
    fieldTravelMatrix: z
      .array(z.array(z.coerce.number().int().min(0).max(240)))
      .optional(),
    /** First allowed game start each day (HH:mm in tournament timezone). */
    dayStartTime: hmSchema,
    /** Games must start before this time each day (HH:mm). */
    dayEndTime: hmSchema,
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
  .refine((d) => d.dayStartTime < d.dayEndTime, {
    message: "Daily end time must be after daily start time",
    path: ["dayEndTime"],
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
    const matrix = d.fieldTravelMatrix;
    if (matrix != null) {
      if (matrix.length !== d.fieldCount) {
        ctx.addIssue({
          code: "custom",
          message: `Travel matrix must be ${d.fieldCount}×${d.fieldCount} (one row per field).`,
          path: ["fieldTravelMatrix"],
        });
      } else {
        for (let i = 0; i < matrix.length; i++) {
          if ((matrix[i]?.length ?? 0) !== d.fieldCount) {
            ctx.addIssue({
              code: "custom",
              message: `Travel matrix row ${i + 1} must have ${d.fieldCount} columns.`,
              path: ["fieldTravelMatrix", i],
            });
          }
        }
      }
    }
  });

export type TournamentWizardInput = z.infer<typeof tournamentWizardSchema>;

/** Resolved team count for a pool row after validation. */
export function wizardPoolTeamCount(pool: TournamentWizardInput["divisions"][0]["pools"][0]): number {
  if (pool.usePlaceholders) return pool.teamCount ?? 0;
  return (pool.teamNames ?? []).map((n) => n.trim()).filter(Boolean).length;
}
