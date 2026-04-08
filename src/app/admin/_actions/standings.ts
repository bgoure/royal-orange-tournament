"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac/permissions";
import { assertPoolInTournament } from "@/lib/services/admin-structure";
import { recomputePoolStandings } from "@/lib/services/standings";
import { getTournamentForRequest } from "@/lib/tournament-context";
import { parseManualRankFields, poolIdSchema } from "@/lib/validations/standings-admin";
import type { Session } from "next-auth";
import type { Tournament } from "@prisma/client";

export type StandingsActionResult = { ok: true } | { ok: false; error: string };

async function standingsContext(): Promise<
  { session: Session; tournament: Tournament } | { error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };
  const tournament = await getTournamentForRequest();
  if (!tournament) {
    return {
      error:
        "Select a tournament on the public site (tournament switcher), then return here.",
    };
  }
  return { session, tournament };
}

function deny(): StandingsActionResult {
  return { ok: false, error: "You don’t have permission for this action." };
}

/**
 * Snapshot current automatic order as rank 1…n, then lock the pool to manual ordering.
 * Use for withdrawals / director overrides (ranks can be edited afterward).
 */
export async function enablePoolStandingsManualMode(
  _prev: StandingsActionResult | undefined,
  formData: FormData,
): Promise<StandingsActionResult> {
  const ctx = await standingsContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "standings:configureRules")) return deny();

  const poolIdRaw = poolIdSchema.safeParse(formData.get("poolId")?.toString());
  if (!poolIdRaw.success) return { ok: false, error: "Invalid pool" };
  const poolId = poolIdRaw.data;

  try {
    await assertPoolInTournament(poolId, ctx.tournament.id);
    const already = await prisma.pool.findFirst({
      where: { id: poolId },
      select: { standingsManualMode: true },
    });
    if (already?.standingsManualMode) {
      revalidatePath("/admin/standings");
      return { ok: true };
    }

    await prisma.pool.update({
      where: { id: poolId },
      data: { standingsManualMode: false },
    });
    await recomputePoolStandings(poolId);

    const rows = await prisma.poolStanding.findMany({
      where: { poolId },
      orderBy: { displayOrder: "asc" },
      select: { id: true, displayOrder: true },
    });
    for (const row of rows) {
      await prisma.poolStanding.update({
        where: { id: row.id },
        data: { tiebreakOverrideRank: row.displayOrder + 1 },
      });
    }

    await prisma.pool.update({
      where: { id: poolId },
      data: { standingsManualMode: true },
    });
    await recomputePoolStandings(poolId);

    revalidatePath("/admin/standings");
    revalidatePath("/standings");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to enable manual mode";
    return { ok: false, error: msg };
  }
}

/** Return to automatic tiebreakers; clears manual ranks for the pool. */
export async function disablePoolStandingsManualMode(
  _prev: StandingsActionResult | undefined,
  formData: FormData,
): Promise<StandingsActionResult> {
  const ctx = await standingsContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "standings:configureRules")) return deny();

  const poolIdRaw = poolIdSchema.safeParse(formData.get("poolId")?.toString());
  if (!poolIdRaw.success) return { ok: false, error: "Invalid pool" };
  const poolId = poolIdRaw.data;

  try {
    await assertPoolInTournament(poolId, ctx.tournament.id);
    await prisma.pool.update({
      where: { id: poolId },
      data: { standingsManualMode: false },
    });
    await prisma.poolStanding.updateMany({
      where: { poolId },
      data: { tiebreakOverrideRank: null },
    });
    await recomputePoolStandings(poolId);

    revalidatePath("/admin/standings");
    revalidatePath("/standings");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to disable manual mode";
    return { ok: false, error: msg };
  }
}

/** Optional tiebreak ranks when the pool uses automatic ordering (ties on points only). */
export async function savePoolAutoTiebreakRanks(
  _prev: StandingsActionResult | undefined,
  formData: FormData,
): Promise<StandingsActionResult> {
  const ctx = await standingsContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "standings:configureRules")) return deny();

  const parsed = parseManualRankFields(formData);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const { poolId, ranks } = parsed;

  try {
    await assertPoolInTournament(poolId, ctx.tournament.id);
    const pool = await prisma.pool.findFirst({
      where: { id: poolId, division: { tournamentId: ctx.tournament.id } },
      select: { standingsManualMode: true, teams: { select: { id: true } } },
    });
    if (!pool) return { ok: false, error: "Pool not found" };
    if (pool.standingsManualMode) {
      return { ok: false, error: "This pool uses manual order — use “Save manual ranks” instead." };
    }

    const allowed = new Set(pool.teams.map((t) => t.id));
    for (const teamId of ranks.keys()) {
      if (!allowed.has(teamId)) {
        return { ok: false, error: "Unknown team in form" };
      }
    }
    for (const t of pool.teams) {
      if (!ranks.has(t.id)) {
        return { ok: false, error: "Each team must have a tiebreak field (blank = none)." };
      }
    }

    await prisma.$transaction(
      pool.teams.map((t) =>
        prisma.poolStanding.upsert({
          where: { poolId_teamId: { poolId, teamId: t.id } },
          create: {
            poolId,
            teamId: t.id,
            tiebreakOverrideRank: ranks.get(t.id) ?? null,
          },
          update: { tiebreakOverrideRank: ranks.get(t.id) ?? null },
        }),
      ),
    );

    await recomputePoolStandings(poolId);

    revalidatePath("/admin/standings");
    revalidatePath("/standings");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save tiebreak ranks";
    return { ok: false, error: msg };
  }
}

export async function savePoolManualStandingsRanks(
  _prev: StandingsActionResult | undefined,
  formData: FormData,
): Promise<StandingsActionResult> {
  const ctx = await standingsContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "standings:configureRules")) return deny();

  const parsed = parseManualRankFields(formData);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const { poolId, ranks } = parsed;

  try {
    await assertPoolInTournament(poolId, ctx.tournament.id);
    const pool = await prisma.pool.findFirst({
      where: { id: poolId, division: { tournamentId: ctx.tournament.id } },
      select: { standingsManualMode: true, teams: { select: { id: true } } },
    });
    if (!pool) return { ok: false, error: "Pool not found" };
    if (!pool.standingsManualMode) {
      return { ok: false, error: "Turn on manual standings for this pool first." };
    }

    const allowed = new Set(pool.teams.map((t) => t.id));
    for (const teamId of ranks.keys()) {
      if (!allowed.has(teamId)) {
        return { ok: false, error: "Unknown team in form" };
      }
    }
    for (const t of pool.teams) {
      if (!ranks.has(t.id)) {
        return { ok: false, error: "Each team must have a rank field (leave blank to float to bottom)." };
      }
    }

    await prisma.$transaction(
      pool.teams.map((t) =>
        prisma.poolStanding.upsert({
          where: { poolId_teamId: { poolId, teamId: t.id } },
          create: {
            poolId,
            teamId: t.id,
            tiebreakOverrideRank: ranks.get(t.id) ?? null,
          },
          update: { tiebreakOverrideRank: ranks.get(t.id) ?? null },
        }),
      ),
    );

    await recomputePoolStandings(poolId);

    revalidatePath("/admin/standings");
    revalidatePath("/standings");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save ranks";
    return { ok: false, error: msg };
  }
}
