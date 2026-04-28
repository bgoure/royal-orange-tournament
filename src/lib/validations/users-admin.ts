import { z } from "zod";

export const updateUserRoleSchema = z
  .object({
    userId: z.string().min(1),
    role: z.enum(["PUBLIC", "POWER_USER", "ADMIN"]),
    divisionIds: z.string().optional().transform((s) => {
      if (!s || s.trim() === "") return [];
      return s.split(",").map((id) => id.trim()).filter(Boolean);
    }),
  })
  .refine(
    (data) => data.role !== "POWER_USER" || data.divisionIds.length > 0,
    { message: "Power users must be assigned to at least one division.", path: ["divisionIds"] },
  );

export const removeUserSchema = z.object({
  userId: z.string().min(1),
});

export const inviteUserSchema = z
  .object({
    email: z.string().trim().email("Valid email is required"),
    name: z
      .string()
      .trim()
      .max(120)
      .optional()
      .transform((s) => (s && s.length > 0 ? s : undefined)),
    role: z.enum(["PUBLIC", "POWER_USER", "ADMIN"]),
    divisionIds: z.string().optional().transform((s) => {
      if (!s || s.trim() === "") return [];
      return s.split(",").map((id) => id.trim()).filter(Boolean);
    }),
  })
  .refine(
    (data) => data.role !== "POWER_USER" || data.divisionIds.length > 0,
    { message: "Power users must be assigned to at least one division.", path: ["divisionIds"] },
  );
