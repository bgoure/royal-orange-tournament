"use server";

import { revalidatePath } from "next/cache";
import { revalidatePublishedTournamentSites } from "@/lib/revalidate-public-tournament-site";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac/permissions";
import { assertPoolInTournament } from "@/lib/services/admin-structure";
import {
  createSingleEliminationBracket,
  regenerateSingleEliminationBracket,
} from "@/lib/services/bracket-generation";
import { parseDatetimeLocalInTimeZone } from "@/lib/datetime-tournament";
import { getTournamentForRequest } from "@/lib/tournament-context";
import {
  createBracketSchema,
  regenerateBracketSchema,
  updatePoolAdvancingSchema,
} from "@/lib/validations/bracket-admin";
import type { Session } from "next-auth";
import type { Tournament } from "@prisma/client";

export type BracketActionResult = { ok: true } | { ok: false; error: string };

async function bracketContext(): Promise<
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

function deny(): BracketActionResult {
  return { ok: false, error: "You don’t have permission for this action." };
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

export async function createPlayoffBracket(
  _prev: BracketActionResult | undefined,
  formData: FormData,
): Promise<BracketActionResult> {
  const ctx = await bracketContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "bracket:configure")) return deny();

  const parsed = createBracketSchema.safeParse({
    name: formData.get("name"),
    fieldId: formData.get("fieldId"),
    scheduledAt: formData.get("scheduledAt"),
    hoursBetweenRounds: formData.get("hoursBetweenRounds") || undefined,
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

  try {
    await createSingleEliminationBracket({
      tournamentId: ctx.tournament.id,
      name: parsed.data.name,
      fieldId: parsed.data.fieldId,
      startsAt: started,
      hoursBetweenRounds: parsed.data.hoursBetweenRounds,
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

export async function regeneratePlayoffBracket(
  _prev: BracketActionResult | undefined,
  formData: FormData,
): Promise<BracketActionResult> {
  const ctx = await bracketContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "bracket:configure")) return deny();

  const parsed = regenerateBracketSchema.safeParse({
    bracketId: formData.get("bracketId"),
    fieldId: formData.get("fieldId"),
    scheduledAt: formData.get("scheduledAt"),
    hoursBetweenRounds: formData.get("hoursBetweenRounds") || undefined,
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

  const bracket = await prisma.bracket.findFirst({
    where: { id: parsed.data.bracketId, tournamentId: ctx.tournament.id },
  });
  if (!bracket) return { ok: false, error: "Bracket not found" };

  const field = await prisma.field.findFirst({
    where: { id: parsed.data.fieldId, tournamentId: ctx.tournament.id },
  });
  if (!field) return { ok: false, error: "Field not found" };

  try {
    await regenerateSingleEliminationBracket({
      tournamentId: ctx.tournament.id,
      bracketId: parsed.data.bracketId,
      fieldId: parsed.data.fieldId,
      startsAt: started,
      hoursBetweenRounds: parsed.data.hoursBetweenRounds,
    });
    revalidatePath("/admin/brackets");
    revalidatePath("/admin/games");
    await revalidatePublishedTournamentSites();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to regenerate bracket";
    return { ok: false, error: msg };
  }
}
