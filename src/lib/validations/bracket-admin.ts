import { BracketSetupMode } from "@prisma/client";
import { z } from "zod";
import { isValidEntryTeamCount } from "@/lib/services/bracket-engine";

export const updatePoolAdvancingSchema = z.object({
  poolId: z.string().min(1),
  teamsAdvancing: z.coerce.number().int().min(0).max(64),
});

export const createBracketSchema = z.object({
  name: z.string().trim().min(1).max(120),
  fieldId: z.string().min(1, "Select a field"),
  scheduledAt: z.string().min(1),
  hoursBetweenRounds: z.coerce.number().min(0).max(168).optional().default(2),
  entryTeamCount: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 8 : Number(v)),
    z.number().int().refine(isValidEntryTeamCount, {
      message: "Entry team count must be a power of 2 between 2 and 64",
    }),
  ),
  consolationEnabled: z.enum(["0", "1"]).transform((v) => v === "1"),
});

export const updateBracketSettingsSchema = z.object({
  bracketId: z.string().min(1),
  setupMode: z.nativeEnum(BracketSetupMode),
  entryTeamCount: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 8 : Number(v)),
    z.number().int().refine(isValidEntryTeamCount, {
      message: "Entry team count must be a power of 2 between 2 and 64",
    }),
  ),
  consolationEnabled: z.enum(["0", "1"]).transform((v) => v === "1"),
});

export const regenerateBracketSchema = z.object({
  bracketId: z.string().min(1),
  fieldId: z.string().min(1, "Select a field"),
  scheduledAt: z.string().min(1),
  hoursBetweenRounds: z.coerce.number().min(0).max(168).optional().default(2),
});
