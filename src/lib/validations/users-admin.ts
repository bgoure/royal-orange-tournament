import { z } from "zod";

export const updateUserRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["PUBLIC", "POWER_USER", "ADMIN"]),
});

export const removeUserSchema = z.object({
  userId: z.string().min(1),
});

export const inviteUserSchema = z.object({
  email: z.string().trim().email("Valid email is required"),
  name: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((s) => (s && s.length > 0 ? s : undefined)),
  role: z.enum(["PUBLIC", "POWER_USER", "ADMIN"]),
});
