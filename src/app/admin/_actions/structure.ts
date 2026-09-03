"use server";

import { revalidatePath } from "next/cache";
import { revalidatePublishedTournamentSites } from "@/lib/revalidate-public-tournament-site";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac/permissions";
import {
  assertDivisionScope,
  assertPoolDivisionScope,
  assertTeamDivisionScope,
} from "@/lib/rbac/division-scope";
import {
  assertDivisionInTournament,
  assertPoolInTournament,
  assertTeamInTournament,
} from "@/lib/services/admin-structure";
import { recomputePoolStandings } from "@/lib/services/standings";
import { teamDeletionBlockReason } from "@/lib/services/team-deletion";
import {
  divisionCreateSchema,
  divisionUpdateSchema,
  importPoolTeamsSchema,
  parseTeamNamesFromPaste,
  poolCreateSchema,
  poolUpdateSchema,
  teamCreateSchema,
  teamUpdateSchema,
} from "@/lib/validations/structure";
import { type TournamentForRequest } from "@/lib/tournament-context";
import { requireAuthorizedTournamentContext } from "@/lib/rbac/tenant-access";
import { isGenericWizardDivisionTitle } from "@/lib/brackets/bracket-public-title";
import type { Session } from "next-auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function tournamentContext(): Promise<
  { session: Session; tournament: TournamentForRequest } | { error: string }
> {
  return requireAuthorizedTournamentContext();
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
  const scopeErr = await assertDivisionScope(ctx.session.user.id, ctx.session.user.role, parsed.data.id);
  if (scopeErr) return { ok: false, error: scopeErr };

  const existing = await prisma.division.findFirst({
    where: { id: parsed.data.id },
    select: { name: true },
  });
  await prisma.division.update({
    where: { id: parsed.data.id },
    data: { name: parsed.data.name, sortOrder: parsed.data.sortOrder },
  });
  if (existing && existing.name !== parsed.data.name) {
    const oldName = existing.name;
    const nextName = parsed.data.name;
    const playoffsOld = `${oldName} Playoffs`;
    const brackets = await prisma.bracket.findMany({
      where: { divisionId: parsed.data.id, tournamentId: ctx.tournament.id },
      select: { id: true, name: true },
    });
    for (const b of brackets) {
      if (b.name === oldName) {
        await prisma.bracket.update({ where: { id: b.id }, data: { name: nextName } });
      } else if (b.name === playoffsOld) {
        await prisma.bracket.update({ where: { id: b.id }, data: { name: `${nextName} Playoffs` } });
      } else if (isGenericWizardDivisionTitle(b.name)) {
        await prisma.bracket.update({ where: { id: b.id }, data: { name: nextName } });
      }
    }
  }
  revalidatePath("/admin/divisions");
  revalidatePath("/admin/teams");
  revalidatePath("/admin/brackets");
  await revalidatePublishedTournamentSites();
  return { ok: true };
}

export async function deleteDivision(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await tournamentContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "division:delete")) return denyPermission();

  const id = formData.get("id")?.toString();
  if (!id) return { ok: false, error: "Missing id" };
  await assertDivisionInTournament(id, ctx.tournament.id);
  const scopeErr = await assertDivisionScope(ctx.session.user.id, ctx.session.user.role, id);
  if (scopeErr) return { ok: false, error: scopeErr };
  // Team deletes no longer cascade into games, so drop the division's games explicitly —
  // otherwise the pool games would survive the cascade with every seat emptied.
  await prisma.$transaction(async (tx) => {
    await tx.game.deleteMany({
      where: {
        tournamentId: ctx.tournament.id,
        OR: [{ divisionId: id }, { pool: { divisionId: id } }, { bracket: { divisionId: id } }],
      },
    });
    await tx.division.delete({ where: { id } });
  });
  revalidatePath("/admin/divisions");
  revalidatePath("/admin/teams");
  await revalidatePublishedTournamentSites();
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
    cardLabelColor: formData.get("cardLabelColor"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" };
  }

  await assertDivisionInTournament(parsed.data.divisionId, ctx.tournament.id);
  const scopeErr = await assertDivisionScope(ctx.session.user.id, ctx.session.user.role, parsed.data.divisionId);
  if (scopeErr) return { ok: false, error: scopeErr };
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
      cardLabelColor: parsed.data.cardLabelColor ?? null,
    },
  });
  revalidatePath("/admin/divisions");
  revalidatePath("/admin/teams");
  await revalidatePublishedTournamentSites();
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
    cardLabelColor: formData.get("cardLabelColor"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  await assertPoolInTournament(parsed.data.id, ctx.tournament.id);
  const poolScopeErr = await assertPoolDivisionScope(
    ctx.session.user.id,
    ctx.session.user.role,
    parsed.data.id,
  );
  if (poolScopeErr) return { ok: false, error: poolScopeErr };
  await prisma.pool.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      sortOrder: parsed.data.sortOrder,
      cardLabelColor: parsed.data.cardLabelColor,
    },
  });
  revalidatePath("/admin/divisions");
  revalidatePath("/admin/teams");
  await revalidatePublishedTournamentSites();
  return { ok: true };
}

export async function deletePool(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await tournamentContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "pool:delete")) return denyPermission();

  const id = formData.get("id")?.toString();
  if (!id) return { ok: false, error: "Missing id" };
  await assertPoolInTournament(id, ctx.tournament.id);
  const deletePoolScopeErr = await assertPoolDivisionScope(ctx.session.user.id, ctx.session.user.role, id);
  if (deletePoolScopeErr) return { ok: false, error: deletePoolScopeErr };
  const poolRow = await prisma.pool.findFirst({
    where: { id, division: { tournamentId: ctx.tournament.id } },
    select: { divisionId: true, _count: { select: { teams: true } } },
  });
  if (!poolRow) return { ok: false, error: "Pool not found" };
  const bracket = await prisma.bracket.findFirst({
    where: { divisionId: poolRow.divisionId },
    select: { id: true },
  });
  if (bracket) {
    return {
      ok: false,
      error: "Remove the playoff bracket for this division before deleting a pool.",
    };
  }
  if (poolRow._count.teams > 0) {
    return {
      ok: false,
      error: "Remove teams from this pool before deleting it.",
    };
  }
  await prisma.pool.delete({ where: { id } });
  revalidatePath("/admin/divisions");
  revalidatePath("/admin/teams");
  await revalidatePublishedTournamentSites();
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
  const scopeErrTeam = await assertPoolDivisionScope(ctx.session.user.id, ctx.session.user.role, parsed.data.poolId);
  if (scopeErrTeam) return { ok: false, error: scopeErrTeam };
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
  await revalidatePublishedTournamentSites();
  return { ok: true };
}

/**
 * Paste one name per line into a pool: rename existing teams in order (seed, then createdAt),
 * then create extras for overflow lines.
 */
export async function importPoolTeams(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await tournamentContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "team:create") || !can(ctx.session.user.role, "team:update")) {
    return denyPermission();
  }

  const parsed = importPoolTeamsSchema.safeParse({
    poolId: formData.get("poolId"),
    namesText: formData.get("namesText"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Invalid input" };
  }

  const names = parseTeamNamesFromPaste(parsed.data.namesText);
  if (names.length === 0) {
    return { ok: false, error: "Paste at least one team name (one per line)." };
  }
  for (const name of names) {
    if (name.length < 1 || name.length > 120) {
      return { ok: false, error: `Team name must be 1–120 characters: “${name.slice(0, 40)}…”` };
    }
  }

  await assertPoolInTournament(parsed.data.poolId, ctx.tournament.id);
  const scopeErr = await assertPoolDivisionScope(
    ctx.session.user.id,
    ctx.session.user.role,
    parsed.data.poolId,
  );
  if (scopeErr) return { ok: false, error: scopeErr };

  const existing = await prisma.team.findMany({
    where: { poolId: parsed.data.poolId },
    orderBy: [{ seed: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    const renameCount = Math.min(existing.length, names.length);
    for (let i = 0; i < renameCount; i++) {
      await tx.team.update({
        where: { id: existing[i]!.id },
        data: { name: names[i]! },
      });
    }
    for (let i = existing.length; i < names.length; i++) {
      await tx.team.create({
        data: {
          poolId: parsed.data.poolId,
          name: names[i]!,
          seed: i + 1,
        },
      });
    }
  });

  await recomputePoolStandings(parsed.data.poolId);
  revalidatePath("/admin/divisions");
  revalidatePath("/admin/teams");
  await revalidatePublishedTournamentSites();
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
  const teamScopeErr = await assertTeamDivisionScope(ctx.session.user.id, ctx.session.user.role, parsed.data.id);
  if (teamScopeErr) return { ok: false, error: teamScopeErr };
  const destPoolScopeErr = await assertPoolDivisionScope(
    ctx.session.user.id,
    ctx.session.user.role,
    parsed.data.poolId,
  );
  if (destPoolScopeErr) return { ok: false, error: destPoolScopeErr };
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
  await revalidatePublishedTournamentSites();
  return { ok: true };
}

export async function deleteTeam(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await tournamentContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "team:delete")) return denyPermission();

  const id = formData.get("id")?.toString();
  if (!id) return { ok: false, error: "Missing id" };
  await assertTeamInTournament(id, ctx.tournament.id);
  const deleteTeamScopeErr = await assertTeamDivisionScope(ctx.session.user.id, ctx.session.user.role, id);
  if (deleteTeamScopeErr) return { ok: false, error: deleteTeamScopeErr };
  const blocked = await teamDeletionBlockReason(id, ctx.tournament.id);
  if (blocked) return { ok: false, error: blocked };
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
  await revalidatePublishedTournamentSites();
  return { ok: true };
}

const MAX_TEAM_LOGO_BYTES = 200_000;
const ALLOWED_TEAM_LOGO_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function uploadTeamLogo(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await tournamentContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "team:update")) return denyPermission();

  const teamId = formData.get("teamId")?.toString();
  const file = formData.get("logo");
  if (!teamId) return { ok: false, error: "Missing team" };
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose an image file (PNG, JPEG, or WebP)." };
  }

  await assertTeamInTournament(teamId, ctx.tournament.id);
  const logoScopeErr = await assertTeamDivisionScope(ctx.session.user.id, ctx.session.user.role, teamId);
  if (logoScopeErr) return { ok: false, error: logoScopeErr };

  if (file.size > MAX_TEAM_LOGO_BYTES) {
    return { ok: false, error: "Logo must be 200KB or smaller." };
  }
  const mimeType = file.type;
  if (!ALLOWED_TEAM_LOGO_MIME.has(mimeType)) {
    return { ok: false, error: "Use PNG, JPEG, or WebP." };
  }

  const buf = Buffer.from(await file.arrayBuffer());

  await prisma.teamLogo.upsert({
    where: { teamId },
    create: { teamId, mimeType, data: buf },
    update: { mimeType, data: buf },
  });

  revalidatePath("/admin/teams");
  await revalidatePublishedTournamentSites();
  return { ok: true };
}

export async function clearTeamLogo(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await tournamentContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!can(ctx.session.user.role, "team:update")) return denyPermission();

  const teamId = formData.get("teamId")?.toString();
  if (!teamId) return { ok: false, error: "Missing team" };

  await assertTeamInTournament(teamId, ctx.tournament.id);
  const clearLogoScopeErr = await assertTeamDivisionScope(ctx.session.user.id, ctx.session.user.role, teamId);
  if (clearLogoScopeErr) return { ok: false, error: clearLogoScopeErr };

  await prisma.teamLogo.deleteMany({ where: { teamId } });

  revalidatePath("/admin/teams");
  await revalidatePublishedTournamentSites();
  return { ok: true };
}
