import { z } from "zod";

export const updateUserRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["PUBLIC", "POWER_USER", "ADMIN"]),
});

export const removeUserSchema = z.object({
  userId: z.string().min(1),
});
