import { z } from "zod";
import { isValidEntryTeamCount } from "@/lib/services/bracket-engine";

export const updatePoolAdvancingSchema = z.object({
  poolId: z.string().min(1),
  teamsAdvancing: z.coerce.number().int().min(0).max(64),
});

const firstRoundSlotSchema = z.object({
  home: z.object({
    poolId: z.string().min(1),
    rank: z.coerce.number().int().min(1).max(64),
  }),
  away: z.object({
    poolId: z.string().min(1),
    rank: z.coerce.number().int().min(1).max(64),
  }),
});

export const createDivisionBracketSchema = z.object({
  name: z.string().trim().min(1).max(120),
  divisionId: z.string().min(1),
  fieldId: z.string().min(1, "Select a field"),
  scheduledAt: z.string().min(1),
  hoursBetweenRounds: z.coerce.number().min(0).max(168).optional().default(2),
  published: z.enum(["0", "1"]).transform((v) => v === "1"),
  firstRound: z.array(firstRoundSlotSchema).min(1),
}).superRefine((data, ctx) => {
  const n = data.firstRound.length * 2;
  if (!isValidEntryTeamCount(n)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "First round must describe a power-of-2 field (2, 4, 8, … teams).",
      path: ["firstRound"],
    });
  }
});

export const toggleBracketPublishedSchema = z.object({
  bracketId: z.string().min(1),
  published: z.enum(["0", "1"]).transform((v) => v === "1"),
});

export const resolveBracketSchema = z.object({
  bracketId: z.string().min(1),
});

export const deleteBracketSchema = z.object({
  bracketId: z.string().min(1),
});
