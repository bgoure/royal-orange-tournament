"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { parseDatetimeLocalInTimeZone } from "@/lib/datetime-tournament";
import { assertFieldInTournament, assertGameInTournament } from "@/lib/services/admin-games";
import { applyFieldHomeToScoringOptional } from "@/lib/services/game-field-home";
import { advanceBracketWinnerFromGame } from "@/lib/services/bracket-advance";
import { recomputePoolStandings } from "@/lib/services/standings";
import { getPublishedTournamentBySlugForActions } from "@/lib/tournament-context";
import { publicQuickGameUpdateSchema } from "@/lib/validations/public-quick-game";

export type PublicQuickGameResult = { ok: true } | { ok: false; error?: string };

export async function updatePublicQuickGameAction(
  _prev: PublicQuickGameResult,
  formData: FormData,
): Promise<PublicQuickGameResult> {
  const session = await auth();
  if (
    !session?.user?.id ||
    (session.user.role !== "ADMIN" && session.user.role !== "POWER_USER")
  ) {
    return { ok: false, error: "You must be signed in as an admin or power user to edit games." };
  }

  const parsed = publicQuickGameUpdateSchema.safeParse({
    tournamentSlug: formData.get("tournamentSlug"),
    id: formData.get("id"),
    fieldId: formData.get("fieldId"),
    scheduledAt: formData.get("scheduledAt"),
    fieldHomeTeamId: formData.get("fieldHomeTeamId"),
    homeRuns: formData.get("homeRuns"),
    awayRuns: formData.get("awayRuns"),
    homeDefensiveInnings: formData.get("homeDefensiveInnings"),
    awayDefensiveInnings: formData.get("awayDefensiveInnings"),
    homeOffensiveInnings: formData.get("homeOffensiveInnings"),
    awayOffensiveInnings: formData.get("awayOffensiveInnings"),
    status: formData.get("status"),
    resultType: formData.get("resultType") || undefined,
    gameKind: formData.get("gameKind"),
  });

  if (!parsed.success) {
    const msg =
      parsed.error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)).join("; ") ||
      "Invalid input";
    return { ok: false, error: msg };
  }

  const tournament = await getPublishedTournamentBySlugForActions(parsed.data.tournamentSlug);
  if (!tournament) {
    return { ok: false, error: "Tournament not found." };
  }

  try {
    const existing = await assertGameInTournament(parsed.data.id, tournament.id);
    if (existing.gameKind !== parsed.data.gameKind) {
      return { ok: false, error: "Game type mismatch; refresh the page and try again." };
    }
    await assertFieldInTournament(parsed.data.fieldId, tournament.id);

    const teamRow = await prisma.game.findFirst({
      where: { id: parsed.data.id, tournamentId: tournament.id },
      select: { homeTeamId: true, awayTeamId: true },
    });
    if (!teamRow) {
      return { ok: false, error: "Game not found." };
    }

    let scheduledAt: Date;
    try {
      scheduledAt = parseDatetimeLocalInTimeZone(parsed.data.scheduledAt, tournament.timezone);
    } catch {
      return { ok: false, error: "Invalid date/time for this tournament's timezone." };
    }

    const d = parsed.data;
    let homeOI = d.homeOffensiveInnings;
    let awayOI = d.awayOffensiveInnings;
    if (homeOI == null && d.awayDefensiveInnings != null) homeOI = d.awayDefensiveInnings;
    if (awayOI == null && d.homeDefensiveInnings != null) awayOI = d.homeDefensiveInnings;

    let merged;
    try {
      merged = applyFieldHomeToScoringOptional(
        teamRow.homeTeamId,
        teamRow.awayTeamId,
        d.fieldHomeTeamId,
        {
          homeRuns: d.homeRuns,
          awayRuns: d.awayRuns,
          homeDefensiveInnings: d.homeDefensiveInnings,
          awayDefensiveInnings: d.awayDefensiveInnings,
          homeOffensiveInnings: homeOI,
          awayOffensiveInnings: awayOI,
          resultType: d.resultType ?? "REGULAR",
        },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid field home.";
      return { ok: false, error: msg };
    }

    await prisma.game.update({
      where: { id: d.id },
      data: {
        fieldId: d.fieldId,
        scheduledAt,
        schedulePlaceholder: false,
        homeTeamId: merged.homeTeamId,
        awayTeamId: merged.awayTeamId,
        homeRuns: merged.homeRuns,
        awayRuns: merged.awayRuns,
        homeDefensiveInnings: merged.homeDefensiveInnings,
        awayDefensiveInnings: merged.awayDefensiveInnings,
        homeOffensiveInnings: merged.homeOffensiveInnings,
        awayOffensiveInnings: merged.awayOffensiveInnings,
        status: d.status,
        resultType: merged.resultType,
      },
    });

    if (existing.poolId) {
      await recomputePoolStandings(existing.poolId);
    }
    if (d.status === "FINAL") {
      await advanceBracketWinnerFromGame(d.id);
    }

    revalidatePath(`/${tournament.slug}`, "layout");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update game.";
    return { ok: false, error: msg };
  }
}
