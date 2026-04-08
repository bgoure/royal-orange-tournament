import { z } from "zod";

const poolRowSchema = z
  .object({
    name: z.string().trim().min(1, "Pool name is required").max(120),
    teamCount: z.coerce.number().int().min(1, "At least one team per pool").max(999),
    teamsAdvancing: z.coerce.number().int().min(0).max(999),
  })
  .refine((d) => d.teamsAdvancing <= d.teamCount, {
    message: "Teams advancing cannot exceed team count",
    path: ["teamsAdvancing"],
  });

const divisionSchema = z.object({
  name: z.string().trim().min(1, "Division name is required").max(120),
  pools: z.array(poolRowSchema).min(1, "Each division needs at least one pool"),
});

export const tournamentWizardSchema = z
  .object({
    tournamentName: z.string().trim().min(1, "Tournament name is required").max(200),
    venueName: z.string().trim().min(1, "Venue name is required").max(200),
    venueAddress: z.string().trim().min(1, "Address is required").max(10_000),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    timezone: z.string().trim().min(1).max(120),
    divisions: z.array(divisionSchema).min(1, "At least one division is required"),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

export type TournamentWizardInput = z.infer<typeof tournamentWizardSchema>;
