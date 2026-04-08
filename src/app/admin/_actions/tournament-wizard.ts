"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac/permissions";
import { slugifyTournamentName } from "@/lib/slug";
import { recomputeAllPoolsForTournament } from "@/lib/services/standings";
import { TOURNAMENT_SLUG_COOKIE } from "@/lib/tournament-context";
import { tournamentWizardSchema, type TournamentWizardInput } from "@/lib/validations/tournament-wizard";

export type TournamentWizardResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };

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

async function persistSkeleton(data: TournamentWizardInput): Promise<{ id: string; slug: string }> {
  return prisma.$transaction(async (tx) => {
    const slug = await allocateUniqueSlugTx(tx, data.tournamentName);

    const tournament = await tx.tournament.create({
      data: {
        name: data.tournamentName,
        slug,
        shortLabel: data.tournamentName.length <= 32 ? data.tournamentName : `${data.tournamentName.slice(0, 29)}…`,
        startDate: parseDateOnlyUtc(data.startDate),
        endDate: parseDateOnlyUtc(data.endDate),
        timezone: data.timezone,
        locationLabel: data.venueAddress.trim(),
        isPublished: true,
      },
    });

    const location = await tx.location.create({
      data: {
        tournamentId: tournament.id,
        name: data.venueName.trim(),
        address: data.venueAddress.trim(),
        isHeadquarters: true,
        sortOrder: 0,
      },
    });

    await tx.field.create({
      data: {
        tournamentId: tournament.id,
        locationId: location.id,
        name: "Field 1",
        sortOrder: 0,
      },
    });

    for (let di = 0; di < data.divisions.length; di++) {
      const divData = data.divisions[di]!;
      const division = await tx.division.create({
        data: {
          tournamentId: tournament.id,
          name: divData.name.trim(),
          sortOrder: di,
        },
      });

      for (let pi = 0; pi < divData.pools.length; pi++) {
        const poolData = divData.pools[pi]!;
        const pool = await tx.pool.create({
          data: {
            divisionId: division.id,
            name: poolData.name.trim(),
            sortOrder: pi,
            teamsAdvancing: poolData.teamsAdvancing,
          },
        });

        for (let ti = 0; ti < poolData.teamCount; ti++) {
          const teamLabel = `${divData.name} · ${poolData.name} · Team ${ti + 1}`;
          await tx.team.create({
            data: {
              poolId: pool.id,
              name: teamLabel.length > 120 ? teamLabel.slice(0, 117) + "…" : teamLabel,
            },
          });
        }
      }
    }

    return { id: tournament.id, slug };
  });
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
    const { id, slug } = await persistSkeleton(parsed.data);
    await recomputeAllPoolsForTournament(id);

    (await cookies()).set(TOURNAMENT_SLUG_COOKIE, slug, {
      path: "/",
      maxAge: 60 * 60 * 24 * 400,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    revalidatePath("/", "layout");
    revalidatePath("/admin", "layout");
    return { ok: true, slug };
  } catch (e) {
    console.error(e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create tournament." };
  }
}
