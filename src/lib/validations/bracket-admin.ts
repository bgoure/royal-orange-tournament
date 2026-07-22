import { z } from "zod";
import { isValidEntryTeamCount } from "@/lib/services/bracket-engine";

export const updatePoolAdvancingSchema = z.object({
  poolId: z.string().min(1),
  teamsAdvancing: z.coerce.number().int().min(0).max(64),
});

const firstRoundSideSchema = z.union([
  z.object({
    bye: z.literal(true),
  }),
  z.object({
    poolId: z.string().min(1),
    rank: z.coerce.number().int().min(1).max(64),
  }),
]);

const firstRoundSlotSchema = z.object({
  home: firstRoundSideSchema,
  away: firstRoundSideSchema,
});

export const createDivisionBracketSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    divisionId: z.string().min(1),
    fieldId: z.string().min(1, "Select a field"),
    scheduledAt: z.string().min(1),
    hoursBetweenRounds: z.coerce.number().min(0).max(168).optional().default(2),
    published: z.enum(["0", "1"]).transform((v) => v === "1"),
    format: z
      .enum(["SINGLE_ELIMINATION", "DOUBLE_ELIMINATION"])
      .optional()
      .default("SINGLE_ELIMINATION"),
    firstRound: z.array(firstRoundSlotSchema).min(1),
  })
  .superRefine((data, ctx) => {
    const n = data.firstRound.length * 2;
    if (!isValidEntryTeamCount(n)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "First round must describe a power-of-2 bracket size (2, 4, 8, …); use BYE sides to pad.",
        path: ["firstRound"],
      });
    }
    for (let i = 0; i < data.firstRound.length; i++) {
      const s = data.firstRound[i]!;
      if ("bye" in s.home && "bye" in s.away) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "BYE vs BYE is not allowed.",
          path: ["firstRound", i],
        });
      }
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

export const createConsolationGameSchema = z.object({
  divisionId: z.string().min(1),
  fieldId: z.string().min(1, "Select a field"),
  scheduledAt: z.string().min(1),
  homePoolId: z.string().min(1),
  homeRank: z.coerce.number().int().min(1).max(64),
  awayPoolId: z.string().min(1),
  awayRank: z.coerce.number().int().min(1).max(64),
  schedulePlaceholder: z.enum(["0", "1"]).optional().transform((v) => v === "1"),
  gameNumber: z.preprocess(
    (v) => (v == null || String(v).trim() === "" ? undefined : String(v).trim()),
    z.string().max(64).optional(),
  ),
});

export const deleteConsolationGameSchema = z.object({
  gameId: z.string().min(1),
});
