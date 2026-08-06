import { z } from "zod";

const sideSchema = z.union([
  z.object({ bye: z.literal(true) }),
  z.object({ teamId: z.string().min(1) }),
]);

export const saveBracketRoundZeroSeedingSchema = z
  .object({
    bracketId: z.string().min(1),
    slots: z
      .array(
        z.object({
          matchId: z.string().min(1),
          home: sideSchema,
          away: sideSchema,
        }),
      )
      .min(1),
  })
  .superRefine((data, ctx) => {
    const teamIds: string[] = [];
    for (let i = 0; i < data.slots.length; i++) {
      const s = data.slots[i]!;
      if ("bye" in s.home && "bye" in s.away) {
        ctx.addIssue({
          code: "custom",
          message: "BYE vs BYE is not allowed.",
          path: ["slots", i],
        });
      }
      if ("teamId" in s.home) teamIds.push(s.home.teamId);
      if ("teamId" in s.away) teamIds.push(s.away.teamId);
    }
    if (new Set(teamIds).size !== teamIds.length) {
      ctx.addIssue({
        code: "custom",
        message: "Each team can only appear once in Round 1.",
        path: ["slots"],
      });
    }
  });

export type SaveBracketRoundZeroSeedingInput = z.infer<typeof saveBracketRoundZeroSeedingSchema>;
