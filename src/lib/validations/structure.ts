import { PoolCardLabelColor } from "@prisma/client";
import { z } from "zod";

const poolCardLabelColorField = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return null;
  return v;
}, z.nativeEnum(PoolCardLabelColor).nullable());

export const divisionCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  sortOrder: z.coerce.number().int().optional(),
});

export const divisionUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  sortOrder: z.coerce.number().int(),
});

export const poolCreateSchema = z.object({
  divisionId: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(120),
  sortOrder: z.coerce.number().int().optional(),
  cardLabelColor: poolCardLabelColorField.optional(),
});

export const poolUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  sortOrder: z.coerce.number().int(),
  cardLabelColor: poolCardLabelColorField,
});

const optionalSeed = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}, z.number().int().min(0).max(999).optional());

export const teamCreateSchema = z.object({
  poolId: z.string().min(1, "Pool is required"),
  name: z.string().trim().min(1, "Name is required").max(120),
  seed: optionalSeed,
});

export const teamUpdateSchema = z.object({
  id: z.string().min(1),
  poolId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  seed: optionalSeed,
});

/** One team name per line (paste / CSV-ish). Blank lines ignored. */
export const importPoolTeamsSchema = z.object({
  poolId: z.string().min(1, "Pool is required"),
  namesText: z.string().min(1, "Paste at least one team name"),
});

export function parseTeamNamesFromPaste(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[\d]+[.)]\s*/, "").replace(/^["']|["']$/g, "").trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      // Allow "Name, City" CSV first column
      const first = line.includes(",") ? line.split(",")[0]!.trim() : line;
      return first.slice(0, 120);
    })
    .filter((line) => line.length > 0);
}
