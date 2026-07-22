"use server";

import { revalidatePath } from "next/cache";
import { revalidatePublishedTournamentSites } from "@/lib/revalidate-public-tournament-site";
import { auth } from "@/auth";
import { GameKind, type Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac/permissions";
import { assertDivisionScope, assertPoolDivisionScope } from "@/lib/rbac/division-scope";
import { assertFieldInTournament } from "@/lib/services/admin-games";
import { assertPoolInTournament } from "@/lib/services/admin-structure";
import { assertConsolationSlotsAvailable } from "@/lib/services/consolation-slots";
import { createDivisionPlayoffBracket } from "@/lib/services/bracket-division-build";
import { gameCompetitiveResetData } from "@/lib/services/game-competitive-reset";
import { resolveBracketTeamsFromStandings } from "@/lib/services/bracket-resolution";
import { assertDivisionRoundRobinCompleteForSeeding } from "@/lib/services/round-robin-division";
import { parseDatetimeLocalInTimeZone } from "@/lib/datetime-tournament";
import { getTournamentForRequest, tournamentForRequestInclude, type TournamentForRequest } from "@/lib/tournament-context";
import {
  createConsolationGameSchema,
  createDivisionBracketSchema,
  deleteBracketSchema,
  deleteConsolationGameSchema,
  resolveBracketSchema,
  toggleBracketPublishedSchema,
  updatePoolAdvancingSchema,
} from "@/lib/validations/bracket-admin";
import type { Session } from "next-auth";

export type BracketActionResult = { ok: true } | { ok: false; error: string };

async function bracketContext(): Promise<
  { session: Session; tournament: TournamentForRequest } | { error: string }
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

async function bracketActionContext(
  formData: FormData,
): Promise<{ session: Session; tournament: TournamentForRequest } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const tid = formData.get("tournamentId")?.toString().trim();
  if (tid) {
    const tournament = await prisma.tournament.findFirst({
      where: { id: tid, isPublished: true },
      include: tournamentForRequestInclude,
    });
    if (!tournament) return { error: "Tournament not found." };
    return { session, tournament };
  }

  const tournament = await getTournamentForRequest();
  if (!tournament) {
    return {
      error:
        "Select a tournament on the public site (tournament switcher), then return here.",
    };
  }
  return { session, tournament };
}

function canPushOrResetBracketRole(role: Role): boolean {
  return can(role, "bracket:configure") || can(role, "bracket:pushAndReset");
}

function deny(): BracketActionResult {
  return { ok: false, error: "You don’t have permission for this action." };
}

async function assertDivisionInTournament(divisionId: string, tournamentId: string) {
  const d = await prisma.division.findFirst({
    where: { id: divisionId, tournamentId },
    select: { id: true },
  });
  if (!d) throw new Error("Division not found in this tournament");
}

async function assertPoolInDivision(poolId: string, divisionId: string) {
  const p = await prisma.pool.findFirst({
    where: { id: poolId, divisionId },
    select: { id: true },
  });
  if (!p) throw new Error("Pool must belong to the selected division");
}

export async function updatePoolTeamsAdvancing(
  _prev: BracketActionResult | undefined,
  formData: FormData,
): Promise<BracketActionResult> {
  const ctx = await bracketContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "bracket:configure")) return deny();

  const parsed = updatePoolAdvancingSchema.safeParse({
    poolId: formData.get("poolId"),
    teamsAdvancing: formData.get("teamsAdvancing"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" };
  }

  try {
    await assertPoolInTournament(parsed.data.poolId, ctx.tournament.id);
    const poolScopeErr = await assertPoolDivisionScope(
      ctx.session.user.id,
      ctx.session.user.role,
      parsed.data.poolId,
    );
    if (poolScopeErr) return { ok: false, error: poolScopeErr };
    await prisma.pool.update({
      where: { id: parsed.data.poolId },
      data: { teamsAdvancing: parsed.data.teamsAdvancing },
    });
    revalidatePath("/admin/brackets");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update pool";
    return { ok: false, error: msg };
  }
}

export async function createDivisionPlayoffBracketAction(
  _prev: BracketActionResult | undefined,
  formData: FormData,
): Promise<BracketActionResult> {
  const ctx = await bracketContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "bracket:configure")) return deny();

  let firstRound: { home: { poolId: string; rank: number }; away: { poolId: string; rank: number } }[];
  try {
    const raw = formData.get("firstRound")?.toString() ?? "";
    firstRound = JSON.parse(raw) as typeof firstRound;
    if (!Array.isArray(firstRound)) throw new Error("Invalid first round");
  } catch {
    return { ok: false, error: "Invalid first-round configuration" };
  }

  const parsed = createDivisionBracketSchema.safeParse({
    name: formData.get("name"),
    divisionId: formData.get("divisionId"),
    fieldId: formData.get("fieldId"),
    scheduledAt: formData.get("scheduledAt"),
    hoursBetweenRounds: formData.get("hoursBetweenRounds") || undefined,
    published: formData.get("published") === "1" ? "1" : "0",
    format: formData.get("format") || "SINGLE_ELIMINATION",
    pairingMode: formData.get("pairingMode") || "classic",
    avoidRematchesUntilForced: formData.get("avoidRematchesUntilForced") === "1" ? "1" : "0",
    firstRound,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" };
  }

  let started: Date;
  try {
    started = parseDatetimeLocalInTimeZone(parsed.data.scheduledAt, ctx.tournament.timezone);
  } catch {
    return { ok: false, error: "Invalid start time for this tournament's timezone" };
  }

  const field = await prisma.field.findFirst({
    where: { id: parsed.data.fieldId, tournamentId: ctx.tournament.id },
  });
  if (!field) return { ok: false, error: "Field not found" };

  const createBracketScopeErr = await assertDivisionScope(
    ctx.session.user.id,
    ctx.session.user.role,
    parsed.data.divisionId,
  );
  if (createBracketScopeErr) return { ok: false, error: createBracketScopeErr };

  try {
    await createDivisionPlayoffBracket({
      tournamentId: ctx.tournament.id,
      divisionId: parsed.data.divisionId,
      name: parsed.data.name,
      fieldId: parsed.data.fieldId,
      startsAt: started,
      hoursBetweenRounds: parsed.data.hoursBetweenRounds,
      firstRound: parsed.data.firstRound,
      published: parsed.data.published ?? false,
      format: parsed.data.format,
      avoidRematchesUntilForced: parsed.data.avoidRematchesUntilForced,
    });
    revalidatePath("/admin/brackets");
    revalidatePath("/admin/games");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create bracket";
    return { ok: false, error: msg };
  }
}

export async function toggleBracketPublished(
  _prev: BracketActionResult | undefined,
  formData: FormData,
): Promise<BracketActionResult> {
  const ctx = await bracketContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "bracket:configure")) return deny();

  const parsed = toggleBracketPublishedSchema.safeParse({
    bracketId: formData.get("bracketId"),
    published: formData.get("published") ?? "0",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" };
  }

  try {
    const existing = await prisma.bracket.findFirst({
      where: { id: parsed.data.bracketId, tournamentId: ctx.tournament.id },
      select: { id: true, divisionId: true },
    });
    if (!existing) return { ok: false, error: "Bracket not found" };
    const toggleScopeErr = await assertDivisionScope(
      ctx.session.user.id,
      ctx.session.user.role,
      existing.divisionId,
    );
    if (toggleScopeErr) return { ok: false, error: toggleScopeErr };
    const ok = await prisma.bracket.updateMany({
      where: { id: parsed.data.bracketId, tournamentId: ctx.tournament.id },
      data: { published: parsed.data.published },
    });
    if (ok.count === 0) return { ok: false, error: "Bracket not found" };
    revalidatePath("/admin/brackets");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update visibility";
    return { ok: false, error: msg };
  }
}

export async function applyBracketResolution(
  _prev: BracketActionResult | undefined,
  formData: FormData,
): Promise<BracketActionResult> {
  const ctx = await bracketActionContext(formData);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!canPushOrResetBracketRole(ctx.session.user.role)) return deny();

  const parsed = resolveBracketSchema.safeParse({
    bracketId: formData.get("bracketId"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" };
  }

  try {
    const b = await prisma.bracket.findFirst({
      where: { id: parsed.data.bracketId, tournamentId: ctx.tournament.id },
      select: { id: true, divisionId: true },
    });
    if (!b) return { ok: false, error: "Bracket not found" };
    const scopeErr = await assertDivisionScope(ctx.session.user.id, ctx.session.user.role, b.divisionId);
    if (scopeErr) return { ok: false, error: scopeErr };
    await resolveBracketTeamsFromStandings(parsed.data.bracketId);
    revalidatePath("/admin/brackets");
    revalidatePath("/admin/games");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to apply standings";
    return { ok: false, error: msg };
  }
}

export async function createConsolationGameAction(
  _prev: BracketActionResult | undefined,
  formData: FormData,
): Promise<BracketActionResult> {
  const ctx = await bracketContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "bracket:configure")) return deny();

  const parsed = createConsolationGameSchema.safeParse({
    divisionId: formData.get("divisionId"),
    fieldId: formData.get("fieldId"),
    scheduledAt: formData.get("scheduledAt"),
    homePoolId: formData.get("homePoolId"),
    homeRank: formData.get("homeRank"),
    awayPoolId: formData.get("awayPoolId"),
    awayRank: formData.get("awayRank"),
    schedulePlaceholder: formData.get("schedulePlaceholder") ?? "0",
    gameNumber: formData.get("gameNumber"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" };
  }

  try {
    await assertDivisionInTournament(parsed.data.divisionId, ctx.tournament.id);
    const consolScopeErr = await assertDivisionScope(
      ctx.session.user.id,
      ctx.session.user.role,
      parsed.data.divisionId,
    );
    if (consolScopeErr) return { ok: false, error: consolScopeErr };
    await assertPoolInDivision(parsed.data.homePoolId, parsed.data.divisionId);
    await assertPoolInDivision(parsed.data.awayPoolId, parsed.data.divisionId);
    await assertFieldInTournament(parsed.data.fieldId, ctx.tournament.id);
    await assertConsolationSlotsAvailable(
      parsed.data.divisionId,
      { poolId: parsed.data.homePoolId, rank: parsed.data.homeRank },
      { poolId: parsed.data.awayPoolId, rank: parsed.data.awayRank },
    );

    let scheduledAt: Date;
    try {
      scheduledAt = parseDatetimeLocalInTimeZone(parsed.data.scheduledAt, ctx.tournament.timezone);
    } catch {
      return { ok: false, error: "Invalid start time for this tournament's timezone" };
    }

    await prisma.game.create({
      data: {
        tournamentId: ctx.tournament.id,
        gameKind: GameKind.CONSOLATION,
        divisionId: parsed.data.divisionId,
        poolId: null,
        bracketId: null,
        bracketRoundId: null,
        bracketPosition: null,
        fieldId: parsed.data.fieldId,
        scheduledAt,
        schedulePlaceholder: parsed.data.schedulePlaceholder ?? false,
        consolationHomePoolId: parsed.data.homePoolId,
        consolationHomeRank: parsed.data.homeRank,
        consolationAwayPoolId: parsed.data.awayPoolId,
        consolationAwayRank: parsed.data.awayRank,
        gameNumber: parsed.data.gameNumber ?? null,
        status: "SCHEDULED",
        resultType: "REGULAR",
      },
    });

    revalidatePath("/admin/brackets");
    revalidatePath("/admin/games");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create consolation game";
    return { ok: false, error: msg };
  }
}

export async function deleteConsolationGameAction(
  _prev: BracketActionResult | undefined,
  formData: FormData,
): Promise<BracketActionResult> {
  const ctx = await bracketContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "bracket:configure")) return deny();

  const parsed = deleteConsolationGameSchema.safeParse({
    gameId: formData.get("gameId"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" };
  }

  try {
    const existing = await prisma.game.findFirst({
      where: {
        id: parsed.data.gameId,
        tournamentId: ctx.tournament.id,
        gameKind: GameKind.CONSOLATION,
      },
      select: { id: true, divisionId: true },
    });
    if (!existing) return { ok: false, error: "Consolation game not found" };
    if (existing.divisionId) {
      const delConsolScopeErr = await assertDivisionScope(
        ctx.session.user.id,
        ctx.session.user.role,
        existing.divisionId,
      );
      if (delConsolScopeErr) return { ok: false, error: delConsolScopeErr };
    }

    await prisma.game.delete({ where: { id: existing.id } });
    revalidatePath("/admin/brackets");
    revalidatePath("/admin/games");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to delete game";
    return { ok: false, error: msg };
  }
}

export async function resetPlayoffBracket(
  _prev: BracketActionResult | undefined,
  formData: FormData,
): Promise<BracketActionResult> {
  const ctx = await bracketActionContext(formData);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!canPushOrResetBracketRole(ctx.session.user.role)) return deny();

  const parsed = deleteBracketSchema.safeParse({
    bracketId: formData.get("bracketId"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid bracket" };
  }

  try {
    const existing = await prisma.bracket.findFirst({
      where: { id: parsed.data.bracketId, tournamentId: ctx.tournament.id },
      select: { id: true, divisionId: true },
    });
    if (!existing) return { ok: false, error: "Bracket not found" };

    const scopeErr = await assertDivisionScope(ctx.session.user.id, ctx.session.user.role, existing.divisionId);
    if (scopeErr) return { ok: false, error: scopeErr };

    await assertDivisionRoundRobinCompleteForSeeding(ctx.tournament.id, existing.divisionId);

    await prisma.$transaction(async (tx) => {
      await tx.game.updateMany({
        where: { bracketId: existing.id },
        data: { ...gameCompetitiveResetData },
      });
      await tx.game.updateMany({
        where: {
          tournamentId: ctx.tournament.id,
          divisionId: existing.divisionId,
          gameKind: GameKind.CONSOLATION,
        },
        data: { ...gameCompetitiveResetData },
      });
      await tx.bracket.update({
        where: { id: existing.id },
        data: { needsResolutionRefresh: true },
      });
    });

    revalidatePath("/admin/brackets");
    revalidatePath("/admin/games");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to reset bracket";
    return { ok: false, error: msg };
  }
}

export async function deletePlayoffBracket(
  _prev: BracketActionResult | undefined,
  formData: FormData,
): Promise<BracketActionResult> {
  const ctx = await bracketContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "bracket:configure")) return deny();

  const parsed = deleteBracketSchema.safeParse({
    bracketId: formData.get("bracketId"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid bracket" };
  }

  try {
    const existing = await prisma.bracket.findFirst({
      where: { id: parsed.data.bracketId, tournamentId: ctx.tournament.id },
      select: { id: true, divisionId: true },
    });
    if (!existing) return { ok: false, error: "Bracket not found" };
    const deleteBracketScopeErr = await assertDivisionScope(
      ctx.session.user.id,
      ctx.session.user.role,
      existing.divisionId,
    );
    if (deleteBracketScopeErr) return { ok: false, error: deleteBracketScopeErr };

    await prisma.bracket.delete({ where: { id: existing.id } });
    revalidatePath("/admin/brackets");
    revalidatePath("/admin/games");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to delete bracket";
    return { ok: false, error: msg };
  }
}
