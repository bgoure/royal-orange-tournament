"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac/permissions";
import {
  assertDivisionInTournament,
  assertPoolInTournament,
  assertTeamInTournament,
} from "@/lib/services/admin-structure";
import { recomputePoolStandings } from "@/lib/services/standings";
import {
  divisionCreateSchema,
  divisionUpdateSchema,
  poolCreateSchema,
  poolUpdateSchema,
  teamCreateSchema,
  teamUpdateSchema,
} from "@/lib/validations/structure";
import { getTournamentForRequest } from "@/lib/tournament-context";
import type { Session } from "next-auth";
import type { Tournament } from "@prisma/client";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function tournamentContext(): Promise<
  { session: Session; tournament: Tournament } | { error: string }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
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

function denyPermission(): ActionResult {
  return { ok: false, error: "You don’t have permission for this action." };
}

export async function createDivision(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await tournamentContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const role = ctx.session.user.role;
  if (!can(role, "division:create")) return denyPermission();

  const parsed = divisionCreateSchema.safeParse({
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" };
  }

  const maxOrder = await prisma.division.aggregate({
    where: { tournamentId: ctx.tournament.id },
    _max: { sortOrder: true },
  });
  const sortOrder = parsed.data.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1;

  await prisma.division.create({
    data: {
      tournamentId: ctx.tournament.id,
      name: parsed.data.name,
      sortOrder,
    },
  });
  revalidatePath("/admin/divisions");
  revalidatePath("/admin/teams");
  return { ok: true };
}

export async function updateDivision(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await tournamentContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "division:update")) return denyPermission();

  const parsed = divisionUpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input" };
  }

  await assertDivisionInTournament(parsed.data.id, ctx.tournament.id);
  await prisma.division.update({
    where: { id: parsed.data.id },
    data: { name: parsed.data.name, sortOrder: parsed.data.sortOrder },
  });
  revalidatePath("/admin/divisions");
  revalidatePath("/admin/teams");
  return { ok: true };
}

export async function deleteDivision(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await tournamentContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "division:delete")) return denyPermission();

  const id = formData.get("id")?.toString();
  if (!id) return { ok: false, error: "Missing id" };
  await assertDivisionInTournament(id, ctx.tournament.id);
  await prisma.division.delete({ where: { id } });
  revalidatePath("/admin/divisions");
  revalidatePath("/admin/teams");
  revalidatePath("/standings");
  revalidatePath("/schedule");
  return { ok: true };
}

export async function createPool(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await tournamentContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "pool:create")) return denyPermission();

  const parsed = poolCreateSchema.safeParse({
    divisionId: formData.get("divisionId"),
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" };
  }

  await assertDivisionInTournament(parsed.data.divisionId, ctx.tournament.id);
  const maxOrder = await prisma.pool.aggregate({
    where: { divisionId: parsed.data.divisionId },
    _max: { sortOrder: true },
  });
  const sortOrder = parsed.data.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1;

  await prisma.pool.create({
    data: {
      divisionId: parsed.data.divisionId,
      name: parsed.data.name,
      sortOrder,
    },
  });
  revalidatePath("/admin/divisions");
  revalidatePath("/admin/teams");
  return { ok: true };
}

export async function updatePool(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await tournamentContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "pool:update")) return denyPermission();

  const parsed = poolUpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  await assertPoolInTournament(parsed.data.id, ctx.tournament.id);
  await prisma.pool.update({
    where: { id: parsed.data.id },
    data: { name: parsed.data.name, sortOrder: parsed.data.sortOrder },
  });
  revalidatePath("/admin/divisions");
  revalidatePath("/admin/teams");
  return { ok: true };
}

export async function deletePool(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await tournamentContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "pool:delete")) return denyPermission();

  const id = formData.get("id")?.toString();
  if (!id) return { ok: false, error: "Missing id" };
  await assertPoolInTournament(id, ctx.tournament.id);
  await prisma.pool.delete({ where: { id } });
  revalidatePath("/admin/divisions");
  revalidatePath("/admin/teams");
  revalidatePath("/standings");
  revalidatePath("/schedule");
  return { ok: true };
}

export async function createTeam(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await tournamentContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "team:create")) return denyPermission();

  const seedRaw = formData.get("seed");
  const parsed = teamCreateSchema.safeParse({
    poolId: formData.get("poolId"),
    name: formData.get("name"),
    seed: seedRaw === "" || seedRaw == null ? null : seedRaw,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" };
  }

  await assertPoolInTournament(parsed.data.poolId, ctx.tournament.id);
  await prisma.team.create({
    data: {
      poolId: parsed.data.poolId,
      name: parsed.data.name,
      seed: parsed.data.seed ?? undefined,
    },
  });
  await recomputePoolStandings(parsed.data.poolId);
  revalidatePath("/admin/divisions");
  revalidatePath("/admin/teams");
  revalidatePath("/standings");
  revalidatePath("/schedule");
  return { ok: true };
}

export async function updateTeam(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await tournamentContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "team:update")) return denyPermission();

  const seedRaw = formData.get("seed");
  const parsed = teamUpdateSchema.safeParse({
    id: formData.get("id"),
    poolId: formData.get("poolId"),
    name: formData.get("name"),
    seed: seedRaw === "" || seedRaw == null ? null : seedRaw,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" };
  }

  await assertTeamInTournament(parsed.data.id, ctx.tournament.id);
  await assertPoolInTournament(parsed.data.poolId, ctx.tournament.id);
  const existingTeam = await prisma.team.findFirst({
    where: { id: parsed.data.id, pool: { division: { tournamentId: ctx.tournament.id } } },
    select: { poolId: true },
  });
  await prisma.team.update({
    where: { id: parsed.data.id },
    data: {
      poolId: parsed.data.poolId,
      name: parsed.data.name,
      seed: parsed.data.seed ?? null,
    },
  });
  const poolsToRecompute = new Set<string>();
  if (existingTeam?.poolId) poolsToRecompute.add(existingTeam.poolId);
  poolsToRecompute.add(parsed.data.poolId);
  for (const poolId of poolsToRecompute) {
    await recomputePoolStandings(poolId);
  }
  revalidatePath("/admin/divisions");
  revalidatePath("/admin/teams");
  revalidatePath("/standings");
  revalidatePath("/schedule");
  return { ok: true };
}

export async function deleteTeam(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await tournamentContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "team:delete")) return denyPermission();

  const id = formData.get("id")?.toString();
  if (!id) return { ok: false, error: "Missing id" };
  await assertTeamInTournament(id, ctx.tournament.id);
  const doomed = await prisma.team.findFirst({
    where: { id, pool: { division: { tournamentId: ctx.tournament.id } } },
    select: { poolId: true },
  });
  await prisma.team.delete({ where: { id } });
  if (doomed?.poolId) {
    await recomputePoolStandings(doomed.poolId);
  }
  revalidatePath("/admin/divisions");
  revalidatePath("/admin/teams");
  revalidatePath("/standings");
  revalidatePath("/schedule");
  revalidatePath("/brackets");
  return { ok: true };
}
