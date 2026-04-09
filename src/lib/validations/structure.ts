import { z } from "zod";

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
});

export const poolUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  sortOrder: z.coerce.number().int(),
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
