import { z } from "zod";

export const savePoolAssignmentsSchema = z
  .object({
    divisionId: z.string().min(1),
    assignments: z
      .array(
        z.object({
          teamId: z.string().min(1),
          poolId: z.string().min(1),
        }),
      )
      .min(1),
  })
  .superRefine((data, ctx) => {
    const teamIds = data.assignments.map((a) => a.teamId);
    if (new Set(teamIds).size !== teamIds.length) {
      ctx.addIssue({
        code: "custom",
        message: "Each team can only appear once in the assignment payload.",
        path: ["assignments"],
      });
    }
  });

export type SavePoolAssignmentsInput = z.infer<typeof savePoolAssignmentsSchema>;
