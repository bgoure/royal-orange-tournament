import { z } from "zod";

export const updatePoolAdvancingSchema = z.object({
  poolId: z.string().min(1),
  teamsAdvancing: z.coerce.number().int().min(0).max(64),
});

export const createBracketSchema = z.object({
  name: z.string().trim().min(1).max(120),
  fieldId: z.string().min(1, "Select a field"),
  scheduledAt: z.string().min(1),
  hoursBetweenRounds: z.coerce.number().min(0).max(168).optional().default(2),
});

export const regenerateBracketSchema = z.object({
  bracketId: z.string().min(1),
  fieldId: z.string().min(1, "Select a field"),
  scheduledAt: z.string().min(1),
  hoursBetweenRounds: z.coerce.number().min(0).max(168).optional().default(2),
});
