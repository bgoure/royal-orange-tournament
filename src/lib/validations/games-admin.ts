import { GameResultType, GameStatus } from "@prisma/client";
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

export const createGameSchema = z
  .object({
    poolId: z.string().min(1, "Pool is required"),
    fieldId: z.string().min(1, "Select a field"),
    homeTeamId: z.string().min(1),
    awayTeamId: z.string().min(1),
    scheduledAt: z.string().min(1),
    status: z.nativeEnum(GameStatus).optional().default(GameStatus.SCHEDULED),
  })
  .refine((d) => d.homeTeamId !== d.awayTeamId, { message: "Home and away must be different teams" });

export const updateGameMetaSchema = z
  .object({
    id: z.string().min(1),
    poolId: z.string().min(1),
    fieldId: z.string().min(1, "Select a field"),
    homeTeamId: z.string().min(1),
    awayTeamId: z.string().min(1),
    scheduledAt: z.string().min(1),
  })
  .refine((d) => d.homeTeamId !== d.awayTeamId, { message: "Home and away must be different teams" });

export const updateGameScoringSchema = z.object({
  id: z.string().min(1),
  homeRuns: optionalInt,
  awayRuns: optionalInt,
  homeDefensiveInnings: optionalFloat,
  awayDefensiveInnings: optionalFloat,
  homeOffensiveInnings: optionalFloat,
  awayOffensiveInnings: optionalFloat,
  status: z.nativeEnum(GameStatus),
  resultType: z.nativeEnum(GameResultType),
});
