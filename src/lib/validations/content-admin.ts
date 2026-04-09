import { z } from "zod";

export const faqCreateSchema = z.object({
  question: z.string().trim().min(1, "Question is required").max(500),
  answer: z.string().trim().min(1, "Answer is required").max(50_000),
  sortOrder: z.string().optional(),
  published: z.enum(["on", "off"]).optional().transform((v) => v === "on"),
});

export const faqUpdateSchema = z.object({
  id: z.string().min(1),
  question: z.string().trim().min(1).max(500),
  answer: z.string().trim().min(1).max(50_000),
  sortOrder: z.string().optional(),
  published: z.enum(["on", "off"]).optional().transform((v) => v === "on"),
});

export const locationCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  address: z.string().trim().max(10_000).optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  mapLink: z.string().trim().max(2000).optional(),
  sortOrder: z.string().optional(),
});

export const locationUpdateSchema = locationCreateSchema.extend({
  id: z.string().min(1),
});

function parseOptionalFloat(s: string | undefined): number | null {
  if (s == null || s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parsedOptionalCoordinates(latRaw: string | undefined, lonRaw: string | undefined): {
  latitude: number | null;
  longitude: number | null;
} {
  return {
    latitude: parseOptionalFloat(latRaw),
    longitude: parseOptionalFloat(lonRaw),
  };
}

export const tournamentRenameSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
});

export const tournamentHeadquartersSchema = z.object({
  headquartersLocationId: z.string().min(1),
  headquartersName: z.string().trim().max(200).optional(),
  headquartersAddress: z.string().trim().max(10_000).optional(),
  headquartersLatitude: z.string().optional(),
  headquartersLongitude: z.string().optional(),
});

export const adminFieldCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  locationId: z.string().min(1),
  sortOrder: z.string().optional(),
});

export const adminFieldUpdateSchema = adminFieldCreateSchema.extend({
  id: z.string().min(1),
});
