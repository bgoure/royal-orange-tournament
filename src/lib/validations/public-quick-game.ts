import { GameKind, GameResultType, GameStatus } from "@prisma/client";
import { z } from "zod";

const optionalInt = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}, z.number().int().nullable());

const optionalFloat = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}, z.number().nullable());

export const publicQuickGameUpdateSchema = z
  .object({
    tournamentSlug: z.string().trim().min(1),
    id: z.string().min(1),
    fieldId: z.string().min(1, "Select a field"),
    scheduledAt: z.string().min(1),
    fieldHomeTeamId: z
      .preprocess((v) => (v == null || v === "" ? undefined : String(v)), z.string().min(1).optional()),
    homeRuns: optionalInt,
    awayRuns: optionalInt,
    homeDefensiveInnings: optionalFloat,
    awayDefensiveInnings: optionalFloat,
    homeOffensiveInnings: optionalFloat,
    awayOffensiveInnings: optionalFloat,
    status: z.nativeEnum(GameStatus),
    resultType: z.nativeEnum(GameResultType).optional().default(GameResultType.REGULAR),
    gameKind: z.nativeEnum(GameKind),
  })
  .superRefine((data, ctx) => {
    const hasAnyRun = data.homeRuns != null || data.awayRuns != null;
    const poolFinalIncomplete =
      data.gameKind === GameKind.POOL &&
      data.status === "FINAL" &&
      (data.homeRuns == null ||
        data.awayRuns == null ||
        data.homeDefensiveInnings == null ||
        data.awayDefensiveInnings == null);

    if (poolFinalIncomplete) {
      ctx.addIssue({
        code: "custom",
        message:
          "To finalize scoring a game, each team's runs and number of defensive innings must be recorded",
        path: ["homeRuns"],
      });
    } else {
      const poolNeedsInnings = data.gameKind === GameKind.POOL && hasAnyRun;
      if (poolNeedsInnings) {
        if (data.homeDefensiveInnings == null) {
          ctx.addIssue({
            code: "custom",
            message: "Home defensive innings required when runs are entered.",
            path: ["homeDefensiveInnings"],
          });
        }
        if (data.awayDefensiveInnings == null) {
          ctx.addIssue({
            code: "custom",
            message: "Away defensive innings required when runs are entered.",
            path: ["awayDefensiveInnings"],
          });
        }
      }
      if (data.status === "FINAL" && (data.homeRuns == null || data.awayRuns == null)) {
        ctx.addIssue({
          code: "custom",
          message: "Final games need both teams’ runs.",
          path: ["homeRuns"],
        });
      }
    }
    if (data.status === "AWAITING_RESULTS" && (data.homeRuns != null || data.awayRuns != null)) {
      ctx.addIssue({
        code: "custom",
        message: "Clear runs before marking as awaiting results, or mark the game final with scores.",
        path: ["status"],
      });
    }
  });
