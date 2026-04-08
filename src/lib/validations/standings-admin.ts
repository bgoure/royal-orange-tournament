import { z } from "zod";

export const poolIdSchema = z.string().trim().min(1, "Missing pool");

const positiveRank = z.coerce.number().int().positive();

/** Parse "rank_${teamId}" form fields into a map. Empty / invalid → null (unranked → bottom tier). */
export function parseManualRankFields(
  formData: FormData,
): { ok: true; poolId: string; ranks: Map<string, number | null> } | { ok: false; error: string } {
  const poolParsed = poolIdSchema.safeParse(formData.get("poolId")?.toString());
  if (!poolParsed.success) {
    return { ok: false, error: poolParsed.error.flatten().formErrors.join(", ") || "Invalid pool" };
  }
  const poolId = poolParsed.data;
  const ranks = new Map<string, number | null>();
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("rank_")) continue;
    const teamId = key.slice("rank_".length);
    if (!teamId) continue;
    const raw = value?.toString().trim() ?? "";
    if (raw === "") {
      ranks.set(teamId, null);
      continue;
    }
    const n = positiveRank.safeParse(raw);
    if (!n.success) {
      return { ok: false, error: `Invalid rank for team ${teamId}` };
    }
    ranks.set(teamId, n.data);
  }
  return { ok: true, poolId, ranks };
}
