import { z } from "zod";

export const announcementCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  body: z.string().trim().min(1, "Body is required").max(50_000),
  priority: z.enum(["on", "off"]).optional().transform((v) => v === "on"),
  publishedAt: z.string().optional(),
});

export const announcementUpdateSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(50_000),
  priority: z.enum(["on", "off"]).optional().transform((v) => v === "on"),
  publishedAt: z.string().optional(),
});
