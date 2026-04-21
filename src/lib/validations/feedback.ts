import { z } from "zod";

export const publicFeedbackSchema = z.object({
  tournamentSlug: z.string().trim().min(1),
  message: z.string().trim().min(3, "Please enter at least a few characters.").max(8000),
  contactEmail: z
    .string()
    .trim()
    .max(320)
    .optional()
    .transform((s) => (s === "" ? undefined : s))
    .pipe(z.union([z.undefined(), z.string().email("Enter a valid email or leave blank.")])),
  /** Honeypot — must be empty */
  _gotcha: z.string().optional(),
});
