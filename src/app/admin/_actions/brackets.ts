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
import { createObaDeBracket } from "@/lib/services/oba-de-bracket-build";
import { isObaDePresetKey, type ObaDePresetKey } from "@/lib/brackets/oba-de-presets";
import {
  listBracketImplicitSeedSeats,
  placeTeamsOnImplicitSeedSeats,
} from "@/lib/services/bracket-seed-seats";
import { bracketUsesPoolSeeding } from "@/lib/services/admin-brackets";
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
  updateBracketNameSchema,
  updateBracketFeederSchema,
  updateBracketQualifierSchema,
  toggleBracketCelebrationSchema,
  updatePoolAdvancingSchema,
  applyOba13PlacementSchema,
} from "@/lib/validations/bracket-admin";
import { saveBracketRoundZeroSeedingSchema } from "@/lib/validations/bracket-seed-board";
import { advanceByeWinnersInRound0, resyncQualifierConclusion } from "@/lib/services/bracket-advance";
import { listBracketsForTournament } from "@/lib/services/brackets";
import {
  resolveChampionFromBracket,
  shouldShowChampionCelebration,
} from "@/lib/brackets/bracket-champion";
import type { Session } from "next-auth";
import { GrandFinalMode } from "@prisma/client";

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

  const formatPresetRaw = formData.get("formatPreset")?.toString() ?? "";
  if (isObaDePresetKey(formatPresetRaw)) {
    return createSeededDeBracketFromAdmin(ctx, formData, formatPresetRaw);
  }

  let firstRound: unknown;
  try {
    const raw = formData.get("firstRound")?.toString() ?? "";
    firstRound = JSON.parse(raw);
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
    grandFinalMode: formData.get("grandFinalMode") || "SINGLE",
    isQualifier: formData.get("isQualifier") === "1" ? "1" : "0",
    qualifyingTeamCount: formData.get("qualifyingTeamCount") || "1",
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
      grandFinalMode:
        parsed.data.grandFinalMode === "IF_NECESSARY"
          ? GrandFinalMode.IF_NECESSARY
          : GrandFinalMode.SINGLE,
      isQualifier: parsed.data.isQualifier,
      qualifyingTeamCount: parsed.data.qualifyingTeamCount,
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

async function createSeededDeBracketFromAdmin(
  ctx: { session: Session; tournament: TournamentForRequest },
  formData: FormData,
  presetKey: ObaDePresetKey,
): Promise<BracketActionResult> {
  const name = formData.get("name")?.toString()?.trim() ?? "";
  const divisionId = formData.get("divisionId")?.toString() ?? "";
  const fieldId = formData.get("fieldId")?.toString() ?? "";
  const scheduledAt = formData.get("scheduledAt")?.toString() ?? "";
  const hoursBetweenRounds = Number(formData.get("hoursBetweenRounds") || 2);
  const published = formData.get("published") === "1";
  const isQualifier = formData.get("isQualifier") === "1";
  const qualifyingTeamCount = Number(formData.get("qualifyingTeamCount") || 1);

  let teamIds: string[];
  try {
    const raw = formData.get("seedTeamIds")?.toString() ?? "";
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === "string" && x.length > 0)) {
      throw new Error("Invalid seed list");
    }
    teamIds = parsed;
  } catch {
    return { ok: false, error: "Invalid seed order — assign each seed a team." };
  }

  if (!name || !divisionId || !fieldId || !scheduledAt) {
    return { ok: false, error: "Name, division, field, and start time are required." };
  }

  let started: Date;
  try {
    started = parseDatetimeLocalInTimeZone(scheduledAt, ctx.tournament.timezone);
  } catch {
    return { ok: false, error: "Invalid start time for this tournament's timezone" };
  }

  const field = await prisma.field.findFirst({
    where: { id: fieldId, tournamentId: ctx.tournament.id },
  });
  if (!field) return { ok: false, error: "Field not found" };

  const createBracketScopeErr = await assertDivisionScope(
    ctx.session.user.id,
    ctx.session.user.role,
    divisionId,
  );
  if (createBracketScopeErr) return { ok: false, error: createBracketScopeErr };

  const divisionTeams = await prisma.team.findMany({
    where: { pool: { divisionId } },
    select: { id: true },
  });
  const inDivision = new Set(divisionTeams.map((t) => t.id));
  if (teamIds.some((id) => !inDivision.has(id))) {
    return { ok: false, error: "Every seeded team must belong to the selected division." };
  }
  if (new Set(teamIds).size !== teamIds.length) {
    return { ok: false, error: "Duplicate teams in seed order." };
  }

  try {
    await createObaDeBracket({
      tournamentId: ctx.tournament.id,
      divisionId,
      name,
      fieldId,
      startsAt: started,
      hoursBetweenRounds: Number.isFinite(hoursBetweenRounds) ? hoursBetweenRounds : 2,
      teamIds,
      presetKey,
      published,
      isQualifier,
      qualifyingTeamCount: Number.isFinite(qualifyingTeamCount) ? qualifyingTeamCount : 1,
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

export async function updateBracketName(
  _prev: BracketActionResult | undefined,
  formData: FormData,
): Promise<BracketActionResult> {
  const ctx = await bracketContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "bracket:configure")) return deny();

  const parsed = updateBracketNameSchema.safeParse({
    bracketId: formData.get("bracketId"),
    name: formData.get("name"),
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
    const scopeErr = await assertDivisionScope(
      ctx.session.user.id,
      ctx.session.user.role,
      existing.divisionId,
    );
    if (scopeErr) return { ok: false, error: scopeErr };

    const ok = await prisma.bracket.updateMany({
      where: { id: parsed.data.bracketId, tournamentId: ctx.tournament.id },
      data: { name: parsed.data.name },
    });
    if (ok.count === 0) return { ok: false, error: "Bracket not found" };
    revalidatePath("/admin/brackets");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to rename bracket";
    return { ok: false, error: msg };
  }
}

export async function updateBracketQualifierSettings(
  _prev: BracketActionResult | undefined,
  formData: FormData,
): Promise<BracketActionResult> {
  const ctx = await bracketContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "bracket:configure")) return deny();

  const parsed = updateBracketQualifierSchema.safeParse({
    bracketId: formData.get("bracketId"),
    isQualifier: formData.get("isQualifier") === "1" ? "1" : "0",
    qualifyingTeamCount: formData.get("qualifyingTeamCount") || "1",
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
    const scopeErr = await assertDivisionScope(
      ctx.session.user.id,
      ctx.session.user.role,
      existing.divisionId,
    );
    if (scopeErr) return { ok: false, error: scopeErr };

    const ok = await prisma.bracket.updateMany({
      where: { id: parsed.data.bracketId, tournamentId: ctx.tournament.id },
      data: {
        isQualifier: parsed.data.isQualifier,
        qualifyingTeamCount: parsed.data.qualifyingTeamCount,
      },
    });
    if (ok.count === 0) return { ok: false, error: "Bracket not found" };

    await resyncQualifierConclusion(parsed.data.bracketId);
    revalidatePath("/admin/brackets");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update qualifier settings";
    return { ok: false, error: msg };
  }
}

export async function toggleBracketCelebrationPosted(
  _prev: BracketActionResult | undefined,
  formData: FormData,
): Promise<BracketActionResult> {
  const ctx = await bracketContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "bracket:configure")) return deny();

  const parsed = toggleBracketCelebrationSchema.safeParse({
    bracketId: formData.get("bracketId"),
    posted: formData.get("posted") ?? "0",
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
    const scopeErr = await assertDivisionScope(
      ctx.session.user.id,
      ctx.session.user.role,
      existing.divisionId,
    );
    if (scopeErr) return { ok: false, error: scopeErr };

    if (parsed.data.posted) {
      const brackets = await listBracketsForTournament(ctx.tournament.id);
      const bracket = brackets.find((b) => b.id === parsed.data.bracketId);
      if (!bracket) return { ok: false, error: "Bracket not found" };
      const outcome = resolveChampionFromBracket(bracket);
      if (!outcome) {
        return {
          ok: false,
          error: "No champion yet — finish the championship (or set qualifier spots to 1) first.",
        };
      }
      if (!shouldShowChampionCelebration({ ...outcome, celebrationPosted: true })) {
        return {
          ok: false,
          error: "Set teams that advance to 1 before posting Congratulations.",
        };
      }
    }

    const ok = await prisma.bracket.updateMany({
      where: { id: parsed.data.bracketId, tournamentId: ctx.tournament.id },
      data: { celebrationPostedAt: parsed.data.posted ? new Date() : null },
    });
    if (ok.count === 0) return { ok: false, error: "Bracket not found" };
    revalidatePath("/admin/brackets");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update congratulations banner";
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
    if (!(await bracketUsesPoolSeeding(parsed.data.bracketId))) {
      return {
        ok: false,
        error: "This bracket was seeded with teams directly — Apply standings is only for pool-seeded brackets.",
      };
    }
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

    const scopeErr = await assertDivisionScope(
      ctx.session.user.id,
      ctx.session.user.role,
      existing.divisionId,
    );
    if (scopeErr) return { ok: false, error: scopeErr };

    const usesPoolSeeding = await bracketUsesPoolSeeding(existing.id);
    if (usesPoolSeeding) {
      await assertDivisionRoundRobinCompleteForSeeding(ctx.tournament.id, existing.divisionId);
    }

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
        data: {
          needsResolutionRefresh: true,
          // Prior championship / qualifier conclusion must not survive a competitive reset.
          concludedAt: null,
          celebrationPostedAt: null,
        },
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

/**
 * Drag-and-drop Round 1 seeding: set home/away teams or BYEs on existing Round 0 matches.
 * Does not rebuild the bracket tree. Clears later-round SCHEDULED seats, then re-advances BYEs.
 */
export async function saveBracketRoundZeroSeeding(
  _prev: BracketActionResult | undefined,
  formData: FormData,
): Promise<BracketActionResult> {
  const ctx = await bracketContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "bracket:configure")) return deny();

  let slotsRaw: unknown;
  let byeSeedTeamIdsRaw: unknown = [];
  try {
    slotsRaw = JSON.parse(String(formData.get("slots") ?? "[]"));
    const byeRaw = formData.get("byeSeedTeamIds");
    if (byeRaw != null && String(byeRaw).trim() !== "") {
      byeSeedTeamIdsRaw = JSON.parse(String(byeRaw));
    }
  } catch {
    return { ok: false, error: "Invalid seeding payload" };
  }

  const parsed = saveBracketRoundZeroSeedingSchema.safeParse({
    bracketId: formData.get("bracketId"),
    slots: slotsRaw,
    byeSeedTeamIds: byeSeedTeamIdsRaw,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.flatten().formErrors.join(", ") || "Invalid Round 1 seeding",
    };
  }

  try {
    const bracket = await prisma.bracket.findFirst({
      where: { id: parsed.data.bracketId, tournamentId: ctx.tournament.id },
      select: { id: true, divisionId: true, presetKey: true },
    });
    if (!bracket) return { ok: false, error: "Bracket not found" };

    const scopeErr = await assertDivisionScope(
      ctx.session.user.id,
      ctx.session.user.role,
      bracket.divisionId,
    );
    if (scopeErr) return { ok: false, error: scopeErr };

    const round0 = await prisma.bracketRound.findFirst({
      where: { bracketId: bracket.id, roundIndex: 0 },
      include: {
        matches: {
          orderBy: { matchIndex: "asc" },
          include: {
            game: { select: { id: true, status: true, resultType: true } },
          },
        },
      },
    });
    if (!round0) return { ok: false, error: "Round 1 not found" };

    // LIVE always blocked. FINAL REGULAR (played) blocked; FINAL FORFEIT_* (BYE walkovers) can be reseated.
    if (
      round0.matches.some((m) => {
        const g = m.game;
        if (!g) return false;
        if (g.status === "LIVE") return true;
        if (g.status === "FINAL" && g.resultType === "REGULAR") return true;
        return false;
      })
    ) {
      return {
        ok: false,
        error: "Cannot reseat Round 1 while a game is live or already scored.",
      };
    }

    const matchById = new Map(round0.matches.map((m) => [m.id, m]));
    if (parsed.data.slots.length !== round0.matches.length) {
      return { ok: false, error: "Seeding must include every Round 1 game." };
    }
    for (const slot of parsed.data.slots) {
      if (!matchById.has(slot.matchId)) {
        return { ok: false, error: "Unknown Round 1 match in payload." };
      }
    }

    const divisionTeamIds = new Set(
      (
        await prisma.team.findMany({
          where: { pool: { divisionId: bracket.divisionId } },
          select: { id: true },
        })
      ).map((t) => t.id),
    );

    for (const slot of parsed.data.slots) {
      for (const side of [slot.home, slot.away]) {
        if ("teamId" in side && !divisionTeamIds.has(side.teamId)) {
          return { ok: false, error: "A selected team is not in this division." };
        }
      }
    }
    for (const teamId of parsed.data.byeSeedTeamIds) {
      if (!divisionTeamIds.has(teamId)) {
        return { ok: false, error: "A Round 1 bye seed is not in this division." };
      }
    }

    // Any format with mid-bracket seed seats (OBA 5–7, custom maps with the same shape).
    const seedSeats = await listBracketImplicitSeedSeats(bracket.id);
    if (seedSeats.length > 0) {
      if (parsed.data.byeSeedTeamIds.length !== seedSeats.length) {
        return {
          ok: false,
          error: `This bracket needs ${seedSeats.length} Round 1 bye seed(s) assigned (${seedSeats
            .map((s) => s.label)
            .join("; ")}).`,
        };
      }
    } else if (parsed.data.byeSeedTeamIds.length > 0) {
      return {
        ok: false,
        error: "This bracket has no mid-round bye-seed seats — leave the bye-seed list empty.",
      };
    }

    await prisma.$transaction(async (tx) => {
      for (const slot of parsed.data.slots) {
        const match = matchById.get(slot.matchId)!;
        if (!match.gameId) continue;

        const homeIsBye = "bye" in slot.home;
        const awayIsBye = "bye" in slot.away;
        const homeTeamId = homeIsBye ? null : "teamId" in slot.home ? slot.home.teamId : null;
        const awayTeamId = awayIsBye ? null : "teamId" in slot.away ? slot.away.teamId : null;

        await tx.bracketMatch.update({
          where: { id: match.id },
          data: {
            homeIsBye,
            awayIsBye,
            homeSourcePoolId: null,
            homeSourceRank: null,
            awaySourcePoolId: null,
            awaySourceRank: null,
          },
        });

        await tx.game.update({
          where: { id: match.gameId },
          data: {
            homeTeamId,
            awayTeamId,
            status: "SCHEDULED",
            resultType: "REGULAR",
            homeRuns: null,
            awayRuns: null,
            homeDefensiveInnings: null,
            awayDefensiveInnings: null,
            homeOffensiveInnings: null,
            awayOffensiveInnings: null,
          },
        });
      }

      // Clear unplayed later-round seats so BYE re-advance is clean
      await tx.game.updateMany({
        where: {
          bracketId: bracket.id,
          status: { in: ["SCHEDULED", "POSTPONED", "CANCELLED"] },
          bracketRound: { roundIndex: { gt: 0 } },
        },
        data: {
          homeTeamId: null,
          awayTeamId: null,
          homeRuns: null,
          awayRuns: null,
          status: "SCHEDULED",
          resultType: "REGULAR",
        },
      });

      // Place mid-bracket bye seeds (feeder side stays TBD).
      if (seedSeats.length > 0) {
        await placeTeamsOnImplicitSeedSeats(seedSeats, parsed.data.byeSeedTeamIds, tx);
      }
    });

    await advanceByeWinnersInRound0(bracket.id);

    revalidatePath("/admin/brackets");
    revalidatePath("/admin/structure");
    revalidatePath("/admin/games");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save Round 1 seeding";
    return { ok: false, error: msg };
  }
}

/** Phase D: edit explicit match feeders / loser-drop targets for custom maps. */
export async function updateBracketFeederAction(
  _prev: BracketActionResult | undefined,
  formData: FormData,
): Promise<BracketActionResult> {
  const ctx = await bracketContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "bracket:configure")) return deny();

  const kindOrNull = (raw: FormDataEntryValue | null) => {
    const s = String(raw ?? "").trim();
    if (s === "WINNER" || s === "LOSER") return s;
    return null;
  };

  const parsed = updateBracketFeederSchema.safeParse({
    matchId: formData.get("matchId"),
    homeFromMatchId: formData.get("homeFromMatchId"),
    awayFromMatchId: formData.get("awayFromMatchId"),
    homeFromKind: kindOrNull(formData.get("homeFromKind")),
    awayFromKind: kindOrNull(formData.get("awayFromKind")),
    loserDropMatchId: formData.get("loserDropMatchId"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid feeder" };
  }

  try {
    const match = await prisma.bracketMatch.findFirst({
      where: {
        id: parsed.data.matchId,
        bracketRound: { bracket: { tournamentId: ctx.tournament.id } },
      },
      include: {
        bracketRound: { select: { bracketId: true, bracket: { select: { divisionId: true } } } },
      },
    });
    if (!match) return { ok: false, error: "Match not found" };

    const scopeErr = await assertDivisionScope(
      ctx.session.user.id,
      ctx.session.user.role,
      match.bracketRound.bracket.divisionId,
    );
    if (scopeErr) return { ok: false, error: scopeErr };

    const bracketId = match.bracketRound.bracketId;
    const ids = [
      parsed.data.homeFromMatchId,
      parsed.data.awayFromMatchId,
      parsed.data.loserDropMatchId,
    ].filter((x): x is string => Boolean(x));
    if (ids.includes(match.id)) {
      return { ok: false, error: "A match cannot feed or drop into itself." };
    }
    if (ids.length > 0) {
      const peers = await prisma.bracketMatch.count({
        where: {
          id: { in: ids },
          bracketRound: { bracketId },
        },
      });
      if (peers !== ids.length) {
        return { ok: false, error: "Feeder targets must be matches in the same bracket." };
      }
    }

    await prisma.bracketMatch.update({
      where: { id: match.id },
      data: {
        homeFromMatchId: parsed.data.homeFromMatchId,
        awayFromMatchId: parsed.data.awayFromMatchId,
        homeFromKind: parsed.data.homeFromMatchId
          ? (parsed.data.homeFromKind ?? "WINNER")
          : null,
        awayFromKind: parsed.data.awayFromMatchId
          ? (parsed.data.awayFromKind ?? "WINNER")
          : null,
        loserDropMatchId: parsed.data.loserDropMatchId,
      },
    });

    revalidatePath("/admin/brackets");
    revalidatePath("/admin/structure");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update feeder";
    return { ok: false, error: msg };
  }
}

export async function applyOba13PlacementAction(
  _prev: BracketActionResult | undefined,
  formData: FormData,
): Promise<BracketActionResult> {
  const ctx = await bracketContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "bracket:configure") && !can(ctx.session.user.role, "game:update")) {
    return deny();
  }

  let matchups: unknown;
  try {
    matchups = JSON.parse(String(formData.get("matchups") ?? "[]"));
  } catch {
    return { ok: false, error: "Invalid matchup payload." };
  }

  const parsed = applyOba13PlacementSchema.safeParse({
    bracketId: formData.get("bracketId"),
    phase: formData.get("phase"),
    byeTeamId: formData.get("byeTeamId"),
    matchups,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid placement." };
  }

  const bracket = await prisma.bracket.findFirst({
    where: { id: parsed.data.bracketId, tournamentId: ctx.tournament.id },
    select: { id: true, divisionId: true, presetKey: true },
  });
  if (!bracket || (bracket.presetKey !== "oba_de_13" && bracket.presetKey !== "oba_de_12")) {
    return { ok: false, error: "OBA redraw bracket not found." };
  }
  const scopeErr = await assertDivisionScope(
    ctx.session.user.id,
    ctx.session.user.role,
    bracket.divisionId,
  );
  if (scopeErr) return { ok: false, error: scopeErr };

  try {
    if (bracket.presetKey === "oba_de_12") {
      const { applyOba12Placement } = await import("@/lib/services/oba-de-12-placement");
      if (parsed.data.phase === "r7") {
        return { ok: false, error: "12-team placement has no Round 7 step." };
      }
      await applyOba12Placement({
        bracketId: parsed.data.bracketId,
        phase: parsed.data.phase,
        byeTeamId: parsed.data.byeTeamId,
        matchups: parsed.data.matchups,
      });
    } else {
      const { applyOba13Placement } = await import("@/lib/services/oba-de-13-placement");
      await applyOba13Placement(parsed.data);
    }
    const { maybeResolveObaPresetPairings } = await import("@/lib/services/oba-de-redraw");
    await maybeResolveObaPresetPairings(parsed.data.bracketId);
    revalidatePath("/admin/brackets");
    revalidatePath("/admin/games");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save placement";
    return { ok: false, error: msg };
  }
}
