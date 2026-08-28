"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { BracketFormat } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import type { SetupProgress } from "@/lib/admin-setup-checklist";
import { can } from "@/lib/rbac/permissions";
import { slugifyTournamentName } from "@/lib/slug";
import { getTournamentSetupProgress } from "@/lib/services/admin-setup-progress";
import { recomputeAllPoolsForTournament } from "@/lib/services/standings";
import {
  createDivisionPlayoffBracket,
  type FirstRoundSide,
  type FirstRoundSlot,
} from "@/lib/services/bracket-division-build";
import { createObaDeBracket } from "@/lib/services/oba-de-bracket-build";
import { isObaDePresetKey } from "@/lib/brackets/oba-de-presets";
import { classicSingleElimOrder, isValidEntryTeamCount } from "@/lib/services/bracket-engine";
import { GrandFinalMode } from "@prisma/client";
import { assertCanCreateTournamentInOrg } from "@/lib/services/organizations";
import { revalidatePublishedTournamentSites } from "@/lib/revalidate-public-tournament-site";
import { ADMIN_TOURNAMENT_SLUG_COOKIE, TOURNAMENT_SLUG_COOKIE } from "@/lib/tournament-context";
import {
  plusDaysYmdUtc,
  todayYmdInTimeZone,
  tournamentWizardSchema,
  WIZARD_DEFAULTS,
  type TournamentWizardInput,
} from "@/lib/validations/tournament-wizard";

export type TournamentWizardResult =
  | {
      ok: true;
      slug: string;
      setupProgress: SetupProgress;
      finishNotes: string[];
      warnings: string[];
      openCustomBuilder?: boolean;
      /** Preferred admin landing path after create. */
      nextPath: string;
    }
  | {
      ok: false;
      error: string;
      /** Set when the tournament row was created but a later step failed. */
      slug?: string;
      finishNotes?: string[];
    };

function parseDateOnlyUtc(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  return new Date(Date.UTC(y, m - 1, d));
}

async function allocateUniqueSlugTx(tx: Prisma.TransactionClient, displayName: string): Promise<string> {
  const base = slugifyTournamentName(displayName);
  let candidate = base;
  let n = 2;
  for (;;) {
    const clash = await tx.tournament.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
    candidate = `${base}-${n}`;
    n += 1;
    if (n > 10_000) {
      throw new Error("Could not allocate a unique tournament slug");
    }
  }
}

function clipName(name: string): string {
  return name.length > 120 ? `${name.slice(0, 117)}…` : name;
}

type PersistResult = {
  id: string;
  slug: string;
  fieldId: string;
  divisionIds: string[];
  openCustomBuilder: boolean;
};

async function persistFromWizard(
  data: TournamentWizardInput,
  organizationId: string | null,
): Promise<PersistResult> {
  const defaults = WIZARD_DEFAULTS;
  const startYmd = todayYmdInTimeZone(defaults.timezone);
  const endYmd = plusDaysYmdUtc(startYmd, 6);

  return prisma.$transaction(async (tx) => {
    const slug = await allocateUniqueSlugTx(tx, data.tournamentName);

    const tournament = await tx.tournament.create({
      data: {
        name: data.tournamentName,
        slug,
        shortLabel:
          data.tournamentName.length <= 32
            ? data.tournamentName
            : `${data.tournamentName.slice(0, 29)}…`,
        startDate: parseDateOnlyUtc(startYmd),
        endDate: parseDateOnlyUtc(endYmd),
        timezone: defaults.timezone,
        locationLabel: defaults.venueAddress,
        /** Draft until directors publish from settings. */
        isPublished: false,
        /** Bracket-only events hide public Results (no pool standings). */
        hasPoolPlay: data.format !== "bracket_only",
        organizationId: organizationId ?? undefined,
      },
    });

    const location = await tx.location.create({
      data: {
        tournamentId: tournament.id,
        name: defaults.venueName,
        address: defaults.venueAddress,
        isHeadquarters: true,
        sortOrder: 0,
      },
    });

    const field = await tx.field.create({
      data: {
        tournamentId: tournament.id,
        locationId: location.id,
        name: "Field 1",
        sortOrder: 0,
      },
    });

    const divisionIds: string[] = [];
    let openCustomBuilder = false;

    if (data.format === "round_robin" && data.roundRobin) {
      for (let di = 0; di < data.roundRobin.divisions.length; di++) {
        const divData = data.roundRobin.divisions[di]!;
        const division = await tx.division.create({
          data: {
            tournamentId: tournament.id,
            name: clipName(divData.name),
            sortOrder: di,
          },
        });
        divisionIds.push(division.id);

        for (let pi = 0; pi < divData.pools.length; pi++) {
          const poolData = divData.pools[pi]!;
          const pool = await tx.pool.create({
            data: {
              divisionId: division.id,
              name: clipName(poolData.name),
              sortOrder: pi,
              teamsAdvancing: poolData.teamsAdvancing,
            },
          });
          for (const teamName of poolData.teamNames) {
            await tx.team.create({
              data: { poolId: pool.id, name: clipName(teamName) },
            });
          }
        }
      }
    } else if (data.format === "bracket_only" && data.bracket) {
      for (let di = 0; di < data.bracket.divisions.length; di++) {
        const divData = data.bracket.divisions[di]!;
        if (divData.buildMode === "custom" || divData.formatPreset === "custom") {
          openCustomBuilder = true;
        }

        const division = await tx.division.create({
          data: {
            tournamentId: tournament.id,
            name: clipName(divData.name),
            sortOrder: di,
          },
        });
        divisionIds.push(division.id);

        const pool = await tx.pool.create({
          data: {
            divisionId: division.id,
            name: "Direct entry",
            sortOrder: 0,
            teamsAdvancing: divData.teamNames.length,
          },
        });

        for (const teamName of divData.teamNames) {
          await tx.team.create({
            data: { poolId: pool.id, name: clipName(teamName) },
          });
        }
      }
    }

    return {
      id: tournament.id,
      slug,
      fieldId: field.id,
      divisionIds,
      openCustomBuilder,
    };
  });
}

function buildFirstRoundFromOrder(
  order: Array<string | null>,
  teamIdByName: Map<string, string>,
): FirstRoundSlot[] {
  const n = order.length;
  const half = n / 2;
  const classic = classicSingleElimOrder(n);
  const sideAt = (seedIndex: number): FirstRoundSide => {
    const name = order[seedIndex];
    if (!name) return { bye: true };
    const id = teamIdByName.get(name) ?? teamIdByName.get(name.trim());
    if (!id) return { bye: true };
    return { teamId: id };
  };
  const slots: FirstRoundSlot[] = [];
  for (let m = 0; m < half; m++) {
    slots.push({
      home: sideAt(classic[m * 2]!),
      away: sideAt(classic[m * 2 + 1]!),
    });
  }
  return slots;
}

function buildAutoFirstRound(teamIds: string[], entrySize: number): FirstRoundSlot[] {
  const classic = classicSingleElimOrder(entrySize);
  const half = entrySize / 2;
  const sideAt = (seedIndex: number): FirstRoundSide => {
    if (seedIndex < teamIds.length) return { teamId: teamIds[seedIndex]! };
    return { bye: true };
  };
  const slots: FirstRoundSlot[] = [];
  for (let m = 0; m < half; m++) {
    slots.push({
      home: sideAt(classic[m * 2]!),
      away: sideAt(classic[m * 2 + 1]!),
    });
  }
  return slots;
}

type BracketWizardCreateResult = {
  notes: string[];
  failures: string[];
  createdCount: number;
  skippedCustomCount: number;
};

async function createBracketsForWizard(
  data: TournamentWizardInput,
  tournamentId: string,
  fieldId: string,
): Promise<BracketWizardCreateResult> {
  const notes: string[] = [];
  const failures: string[] = [];
  let createdCount = 0;
  let skippedCustomCount = 0;
  if (data.format !== "bracket_only" || !data.bracket) {
    return { notes, failures, createdCount, skippedCustomCount };
  }

  const startAt = new Date();
  startAt.setMinutes(0, 0, 0);

  for (let i = 0; i < data.bracket.divisions.length; i++) {
    const divData = data.bracket.divisions[i]!;

    if (divData.buildMode === "custom" || divData.formatPreset === "custom") {
      skippedCustomCount += 1;
      notes.push(
        `${divData.name}: teams saved without a template bracket — create or seed it under Structure / Brackets.`,
      );
      continue;
    }

    const division = await prisma.division.findFirst({
      where: { tournamentId, sortOrder: i },
      include: {
        pools: {
          include: { teams: { orderBy: { createdAt: "asc" } } },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    if (!division) {
      failures.push(`Skipped bracket for ${divData.name}: division not found.`);
      continue;
    }

    const teamIdByName = new Map<string, string>();
    for (const pool of division.pools) {
      for (const t of pool.teams) {
        teamIdByName.set(t.name, t.id);
        teamIdByName.set(t.name.trim(), t.id);
      }
    }

    try {
      if (isObaDePresetKey(divData.formatPreset)) {
        const idsInListOrder = divData.teamNames.map((n) => {
          const id = teamIdByName.get(clipName(n)) ?? teamIdByName.get(n.trim());
          if (!id) throw new Error(`Could not resolve team “${n}”.`);
          return id;
        });
        await createObaDeBracket({
          tournamentId,
          divisionId: division.id,
          name: `${divData.name} Playoffs`,
          fieldId,
          startsAt: startAt,
          hoursBetweenRounds: 2,
          teamIds: idsInListOrder,
          presetKey: divData.formatPreset,
          published: false,
        });
        createdCount += 1;
        notes.push(`Created ${divData.formatPreset.replace(/_/g, " ")} bracket for ${divData.name}.`);
        continue;
      }

      const entrySize = divData.entrySize;
      if (!isValidEntryTeamCount(entrySize)) {
        failures.push(`Skipped bracket for ${divData.name}: invalid field size ${entrySize}.`);
        continue;
      }

      let firstRound: FirstRoundSlot[];
      if (divData.seedMode === "manual" && divData.firstRoundOrder?.length === entrySize) {
        firstRound = buildFirstRoundFromOrder(
          divData.firstRoundOrder.map((n) => (n == null ? null : clipName(n))),
          teamIdByName,
        );
      } else {
        const ids = division.pools.flatMap((p) => p.teams.map((t) => t.id));
        firstRound = buildAutoFirstRound(ids, entrySize);
      }

      const isDe = divData.formatPreset === "double_elim_classic" || divData.bracketFormat === "DOUBLE_ELIMINATION";
      await createDivisionPlayoffBracket({
        tournamentId,
        divisionId: division.id,
        name: `${divData.name} Playoffs`,
        fieldId,
        startsAt: startAt,
        hoursBetweenRounds: 2,
        firstRound,
        published: false,
        format: isDe ? BracketFormat.DOUBLE_ELIMINATION : BracketFormat.SINGLE_ELIMINATION,
        avoidRematchesUntilForced: false,
        grandFinalMode: isDe ? GrandFinalMode.IF_NECESSARY : GrandFinalMode.SINGLE,
      });
      createdCount += 1;
      notes.push(
        `Created ${isDe ? "double" : "single"}-elim bracket for ${divData.name}.`,
      );
    } catch (e) {
      failures.push(
        `Bracket for ${divData.name}: ${e instanceof Error ? e.message : "failed to create"}.`,
      );
    }
  }

  return { notes, failures, createdCount, skippedCustomCount };
}

function pickNextAdminPath(opts: {
  openCustomBuilder: boolean;
  setupProgress: SetupProgress;
  format: TournamentWizardInput["format"];
}): string {
  if (opts.openCustomBuilder) return "/admin/structure?builder=1";
  if (!opts.setupProgress.teamsNamed) return "/admin/teams#paste-team-names";
  if (!opts.setupProgress.hasVenue) return "/admin/tournament-settings";
  if (opts.format === "round_robin" && !opts.setupProgress.hasPoolGames) return "/admin/games";
  if (opts.format === "bracket_only" && !opts.setupProgress.hasBracket) return "/admin/brackets";
  return "/admin/structure";
}

async function bindAdminCookies(slug: string): Promise<void> {
  const jar = await cookies();
  const opts = {
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
  jar.set(TOURNAMENT_SLUG_COOKIE, slug, opts);
  jar.set(ADMIN_TOURNAMENT_SLUG_COOKIE, slug, opts);
}

export async function createTournamentFromWizard(input: unknown): Promise<TournamentWizardResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }
  if (!can(session.user.role, "content:manage")) {
    return { ok: false, error: "You don’t have permission to create a tournament." };
  }

  const parsed = tournamentWizardSchema.safeParse(input);
  if (!parsed.success) {
    const err = parsed.error.flatten();
    const msg =
      err.formErrors.join("; ") ||
      Object.entries(err.fieldErrors)
        .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`)
        .join("; ") ||
      "Invalid input";
    return { ok: false, error: msg };
  }

  try {
    let organizationId: string | null = null;
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });
    if (membership) {
      organizationId = membership.organizationId;
    } else if (session.user.role === "ADMIN") {
      const { createOrganizationForUser } = await import("@/lib/services/organizations");
      const created = await createOrganizationForUser({
        userId: session.user.id,
        name: session.user.name ? `${session.user.name}'s org` : "Default organization",
      });
      organizationId = created.id;
    }

    const planErr = await assertCanCreateTournamentInOrg({
      organizationId,
      isGlobalAdmin: session.user.role === "ADMIN",
    });
    if (planErr) return { ok: false, error: planErr };

    const { id, slug, fieldId, openCustomBuilder } = await persistFromWizard(
      parsed.data,
      organizationId,
    );
    await recomputeAllPoolsForTournament(id);

    const finishNotes: string[] = [];
    const warnings: string[] = [];

    if (parsed.data.format === "bracket_only") {
      const br = await createBracketsForWizard(parsed.data, id, fieldId);
      finishNotes.push(...br.notes);
      warnings.push(...br.failures);

      const templateExpected = parsed.data.bracket!.divisions.filter((d) => d.buildMode === "template").length;
      if (templateExpected > 0 && br.createdCount === 0) {
        await bindAdminCookies(slug);
        const setupProgress = await getTournamentSetupProgress(id);
        revalidatePath("/admin");
        return {
          ok: false,
          error:
            br.failures.join(" ") ||
            "Tournament structure was saved, but no playoff brackets were created.",
          slug,
          finishNotes,
        };
      }
    } else {
      finishNotes.push(
        "Round-robin structure created (draft). Name teams, set venue, then generate the pool schedule when ready.",
      );
      const plan = parsed.data.plannedPlayoff;
      if (plan) {
        const styleLabel = plan.style === "predefined" ? "pre-defined OBA map" : "traditional power-of-2";
        const kindLabel = plan.kind === "DOUBLE_ELIMINATION" ? "double elimination" : "single elimination";
        finishNotes.push(
          `Playoff planned: ${kindLabel}, ${styleLabel}. Create it under Admin → Brackets after pool play.`,
        );
      }
    }

    finishNotes.push("Tournament is a draft (not on the public site) until you publish it in settings.");

    const setupProgress = await getTournamentSetupProgress(id);
    const nextPath = pickNextAdminPath({
      openCustomBuilder,
      setupProgress,
      format: parsed.data.format,
    });

    await bindAdminCookies(slug);

    revalidatePath("/admin");
    revalidatePath("/admin/structure");
    revalidatePath("/admin/divisions");
    revalidatePath("/admin/teams");
    revalidatePath("/admin/brackets");
    revalidatePath("/admin/tournament-settings");
    await revalidatePublishedTournamentSites();

    return {
      ok: true,
      slug,
      setupProgress,
      finishNotes,
      warnings,
      openCustomBuilder,
      nextPath,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create tournament";
    return { ok: false, error: msg };
  }
}
