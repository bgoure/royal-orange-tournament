"use server";

import { revalidatePath } from "next/cache";
import { revalidatePublishedTournamentSites } from "@/lib/revalidate-public-tournament-site";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac/permissions";
import {
  assertFieldInTournament,
  assertGameInTournament,
  assertPoolInTournament,
  assertTeamsInBracketTournament,
  assertTeamsInPool,
} from "@/lib/services/admin-games";
import { advanceBracketWinnerFromGame } from "@/lib/services/bracket-advance";
import { recomputePoolStandings } from "@/lib/services/standings";
import {
  createGameSchema,
  updateBracketGameScheduleSchema,
  updateBracketGameTeamsSchema,
  updateGameMetaSchema,
  updateGameNumberSchema,
  updateGameScoringSchema,
} from "@/lib/validations/games-admin";
import { parseDatetimeLocalInTimeZone } from "@/lib/datetime-tournament";
import { getTournamentForRequest } from "@/lib/tournament-context";
import { GameKind, type Tournament } from "@prisma/client";
import type { Session } from "next-auth";

export type GameActionResult = { ok: true } | { ok: false; error: string };

async function tournamentContext(): Promise<
  { session: Session; tournament: Tournament } | { error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };
  const tournament = await getTournamentForRequest();
  if (!tournament) {
    return {
      error: "Select a tournament on the public site (tournament switcher), then return here.",
    };
  }
  return { session, tournament };
}

function deny(): GameActionResult {
  return { ok: false, error: "You don’t have permission for this action." };
}

async function recomputePools(poolIds: (string | null | undefined)[]) {
  const seen = new Set<string>();
  for (const id of poolIds) {
    if (id && !seen.has(id)) {
      seen.add(id);
      await recomputePoolStandings(id);
    }
  }
}

export async function createGame(
  _prev: GameActionResult | undefined,
  formData: FormData,
): Promise<GameActionResult> {
  const ctx = await tournamentContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const { session, tournament } = ctx;
  if (!can(session.user.role, "game:create")) return deny();

  const parsed = createGameSchema.safeParse({
    poolId: formData.get("poolId"),
    fieldId: formData.get("fieldId"),
    homeTeamId: formData.get("homeTeamId"),
    awayTeamId: formData.get("awayTeamId"),
    scheduledAt: formData.get("scheduledAt"),
    status: formData.get("status") || undefined,
    gameNumber: formData.get("gameNumber"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join(", ") || "Invalid input",
    };
  }

  try {
    await assertPoolInTournament(parsed.data.poolId, tournament.id);
    await assertFieldInTournament(parsed.data.fieldId, tournament.id);
    await assertTeamsInPool(parsed.data.homeTeamId, parsed.data.awayTeamId, parsed.data.poolId);

    let scheduledAt: Date;
    try {
      scheduledAt = parseDatetimeLocalInTimeZone(parsed.data.scheduledAt, tournament.timezone);
    } catch {
      return { ok: false, error: "Invalid date/time for this tournament's timezone" };
    }

    await prisma.game.create({
      data: {
        tournamentId: tournament.id,
        poolId: parsed.data.poolId,
        fieldId: parsed.data.fieldId,
        homeTeamId: parsed.data.homeTeamId,
        awayTeamId: parsed.data.awayTeamId,
        scheduledAt,
        status: parsed.data.status,
        resultType: "REGULAR",
        gameNumber: parsed.data.gameNumber ?? null,
      },
    });

    await recomputePools([parsed.data.poolId]);
    revalidatePath("/admin/games");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create game";
    return { ok: false, error: msg };
  }
}

export async function updateGameScoring(
  _prev: GameActionResult | undefined,
  formData: FormData,
): Promise<GameActionResult> {
  const ctx = await tournamentContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "game:update")) return deny();

  const parsed = updateGameScoringSchema.safeParse({
    id: formData.get("id"),
    homeRuns: formData.get("homeRuns"),
    awayRuns: formData.get("awayRuns"),
    homeDefensiveInnings: formData.get("homeDefensiveInnings"),
    awayDefensiveInnings: formData.get("awayDefensiveInnings"),
    homeOffensiveInnings: formData.get("homeOffensiveInnings"),
    awayOffensiveInnings: formData.get("awayOffensiveInnings"),
    status: formData.get("status"),
    resultType: formData.get("resultType"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid scoring input" };
  }

  try {
    const existing = await assertGameInTournament(parsed.data.id, ctx.tournament.id);
    const d = parsed.data;
    let homeOI = d.homeOffensiveInnings;
    let awayOI = d.awayOffensiveInnings;
    if (homeOI == null && d.awayDefensiveInnings != null) homeOI = d.awayDefensiveInnings;
    if (awayOI == null && d.homeDefensiveInnings != null) awayOI = d.homeDefensiveInnings;

    await prisma.game.update({
      where: { id: d.id },
      data: {
        homeRuns: d.homeRuns,
        awayRuns: d.awayRuns,
        homeDefensiveInnings: d.homeDefensiveInnings,
        awayDefensiveInnings: d.awayDefensiveInnings,
        homeOffensiveInnings: homeOI,
        awayOffensiveInnings: awayOI,
        status: d.status,
        resultType: d.resultType,
      },
    });

    await recomputePools([existing.poolId].filter((id): id is string => id != null));
    if (d.status === "FINAL") {
      await advanceBracketWinnerFromGame(d.id);
    }
    revalidatePath("/admin/games");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update game";
    return { ok: false, error: msg };
  }
}

export async function updateBracketGameSchedule(
  _prev: GameActionResult | undefined,
  formData: FormData,
): Promise<GameActionResult> {
  const ctx = await tournamentContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "game:update")) return deny();

  const parsed = updateBracketGameScheduleSchema.safeParse({
    id: formData.get("id"),
    fieldId: formData.get("fieldId"),
    scheduledAt: formData.get("scheduledAt"),
    gameNumber: formData.get("gameNumber"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid field, time, or game number" };
  }

  try {
    const existing = await assertGameInTournament(parsed.data.id, ctx.tournament.id);
    if (!existing.bracketId && existing.gameKind !== GameKind.CONSOLATION) {
      return { ok: false, error: "Not a bracket or friendly consolation game" };
    }

    const d = parsed.data;
    await assertFieldInTournament(d.fieldId, ctx.tournament.id);

    let scheduledAt: Date;
    try {
      scheduledAt = parseDatetimeLocalInTimeZone(d.scheduledAt, ctx.tournament.timezone);
    } catch {
      return { ok: false, error: "Invalid date/time for this tournament's timezone" };
    }

    await prisma.game.update({
      where: { id: d.id },
      data: {
        fieldId: d.fieldId,
        scheduledAt,
        gameNumber: d.gameNumber,
        schedulePlaceholder: false,
      },
    });

    await recomputePools([existing.poolId].filter((id): id is string => id != null));
    revalidatePath("/admin/games");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update game";
    return { ok: false, error: msg };
  }
}

export async function updateBracketGameTeams(
  _prev: GameActionResult | undefined,
  formData: FormData,
): Promise<GameActionResult> {
  const ctx = await tournamentContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "game:update")) return deny();

  const parsed = updateBracketGameTeamsSchema.safeParse({
    id: formData.get("id"),
    homeTeamId: formData.get("homeTeamId"),
    awayTeamId: formData.get("awayTeamId"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid teams" };
  }

  try {
    const existing = await assertGameInTournament(parsed.data.id, ctx.tournament.id);
    if (!existing.bracketId && existing.gameKind !== GameKind.CONSOLATION) {
      return { ok: false, error: "Not a bracket or friendly consolation game" };
    }
    const d = parsed.data;
    await assertTeamsInBracketTournament(ctx.tournament.id, d.homeTeamId, d.awayTeamId);

    await prisma.game.update({
      where: { id: d.id },
      data: {
        homeTeamId: d.homeTeamId,
        awayTeamId: d.awayTeamId,
      },
    });

    await recomputePools([existing.poolId].filter((id): id is string => id != null));
    revalidatePath("/admin/games");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update game";
    return { ok: false, error: msg };
  }
}

export async function updateGameMeta(
  _prev: GameActionResult | undefined,
  formData: FormData,
): Promise<GameActionResult> {
  const ctx = await tournamentContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "game:update")) return deny();

  const parsed = updateGameMetaSchema.safeParse({
    id: formData.get("id"),
    poolId: formData.get("poolId"),
    fieldId: formData.get("fieldId"),
    homeTeamId: formData.get("homeTeamId"),
    awayTeamId: formData.get("awayTeamId"),
    scheduledAt: formData.get("scheduledAt"),
    gameNumber: formData.get("gameNumber"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid schedule or matchup input" };
  }

  try {
    const existing = await assertGameInTournament(parsed.data.id, ctx.tournament.id);
    const d = parsed.data;
    await assertPoolInTournament(d.poolId, ctx.tournament.id);
    await assertFieldInTournament(d.fieldId, ctx.tournament.id);
    await assertTeamsInPool(d.homeTeamId, d.awayTeamId, d.poolId);

    let scheduledAt: Date;
    try {
      scheduledAt = parseDatetimeLocalInTimeZone(d.scheduledAt, ctx.tournament.timezone);
    } catch {
      return { ok: false, error: "Invalid date/time for this tournament's timezone" };
    }

    await prisma.game.update({
      where: { id: d.id },
      data: {
        poolId: d.poolId,
        fieldId: d.fieldId,
        homeTeamId: d.homeTeamId,
        awayTeamId: d.awayTeamId,
        scheduledAt,
        gameNumber: d.gameNumber,
      },
    });

    await recomputePools([existing.poolId, d.poolId]);
    revalidatePath("/admin/games");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update game";
    return { ok: false, error: msg };
  }
}

export async function updateGameNumber(
  _prev: GameActionResult | undefined,
  formData: FormData,
): Promise<GameActionResult> {
  const ctx = await tournamentContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "game:update")) return deny();

  const parsed = updateGameNumberSchema.safeParse({
    id: formData.get("id"),
    gameNumber: formData.get("gameNumber"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid game ID or number" };
  }

  try {
    await assertGameInTournament(parsed.data.id, ctx.tournament.id);
    await prisma.game.update({
      where: { id: parsed.data.id },
      data: { gameNumber: parsed.data.gameNumber },
    });

    revalidatePath("/admin/games");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update game number";
    return { ok: false, error: msg };
  }
}

export async function deleteGame(
  _prev: GameActionResult | undefined,
  formData: FormData,
): Promise<GameActionResult> {
  const ctx = await tournamentContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "game:delete")) return deny();

  const id = formData.get("id")?.toString();
  if (!id) return { ok: false, error: "Missing id" };

  try {
    const existing = await assertGameInTournament(id, ctx.tournament.id);
    const poolId = existing.poolId;
    if (poolId) {
      const pool = await prisma.pool.findFirst({
        where: { id: poolId, division: { tournamentId: ctx.tournament.id } },
        select: { divisionId: true },
      });
      if (pool) {
        const bracket = await prisma.bracket.findFirst({
          where: { divisionId: pool.divisionId },
        });
        if (bracket) {
          return {
            ok: false,
            error:
              "Cannot delete pool play while a playoff bracket exists for this division. Remove or adjust the bracket first.",
          };
        }
      }
    }
    await prisma.game.delete({ where: { id } });
    await recomputePools([poolId].filter((x): x is string => x != null));
    revalidatePath("/admin/games");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to delete game";
    return { ok: false, error: msg };
  }
}
