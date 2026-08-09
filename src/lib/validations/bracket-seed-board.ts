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
    /** Ordered seed-1, seed-2, … for OBA maps that bye into Round 2 (G3/G4/G5). */
    byeSeedTeamIds: z.array(z.string().min(1)).optional().default([]),
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
    for (const id of data.byeSeedTeamIds) {
      if (teamIds.includes(id)) {
        ctx.addIssue({
          code: "custom",
          message: "A Round 1 bye seed cannot also appear in a Round 1 game.",
          path: ["byeSeedTeamIds"],
        });
        break;
      }
      teamIds.push(id);
    }
    if (new Set(teamIds).size !== teamIds.length) {
      ctx.addIssue({
        code: "custom",
        message: "Each team can only appear once in Round 1 seeding.",
        path: ["slots"],
      });
    }
  });

export type SaveBracketRoundZeroSeedingInput = z.infer<typeof saveBracketRoundZeroSeedingSchema>;
