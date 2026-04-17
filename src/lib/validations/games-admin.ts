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

const gameNumberCreate = z.preprocess((v) => {
  if (v == null || v === "") return undefined;
  const t = String(v).trim().slice(0, 64);
  return t.length > 0 ? t : undefined;
}, z.string().max(64).optional());

const gameNumberMeta = z.preprocess((v) => {
  if (v == null || v === "") return null;
  const t = String(v).trim().slice(0, 64);
  return t.length > 0 ? t : null;
}, z.union([z.string().max(64), z.null()]));

export const createGameSchema = z
  .object({
    poolId: z.string().min(1, "Pool is required"),
    fieldId: z.string().min(1, "Select a field"),
    homeTeamId: z.string().min(1),
    awayTeamId: z.string().min(1),
    scheduledAt: z.string().min(1),
    status: z.nativeEnum(GameStatus).optional().default(GameStatus.SCHEDULED),
    gameNumber: gameNumberCreate,
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
    gameNumber: gameNumberMeta,
  })
  .refine((d) => d.homeTeamId !== d.awayTeamId, { message: "Home and away must be different teams" });

export const updateBracketGameMetaSchema = z
  .object({
    id: z.string().min(1),
    fieldId: z.string().min(1, "Select a field"),
    homeTeamId: z.string().min(1),
    awayTeamId: z.string().min(1),
    scheduledAt: z.string().min(1),
    gameNumber: gameNumberMeta,
  })
  .refine((d) => d.homeTeamId !== d.awayTeamId, { message: "Home and away must be different teams" });

export const updateGameNumberSchema = z.object({
  id: z.string().min(1),
  gameNumber: gameNumberMeta,
});

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
