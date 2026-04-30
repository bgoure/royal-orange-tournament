/**
 * Move selected divisions (and all dependent pool/team/game/bracket data) from a source
 * tournament into a new tournament. Clones locations + fields so moved games satisfy FKs.
 *
 * Defaults match Royal Orange Classic split (12U + 13U → new published tournament).
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." DIRECT_URL="postgresql://..." npx tsx scripts/split-divisions-to-new-tournament.ts
 *   DATABASE_URL="..." npx tsx scripts/split-divisions-to-new-tournament.ts --dry-run
 *
 * Optional env:
 *   SOURCE_TOURNAMENT_SLUG=royal-orange-classic-2026
 *   TARGET_TOURNAMENT_SLUG=12u-13u-2026
 *   TARGET_TOURNAMENT_NAME=Royal Orange classic 2026 12U-13U
 *   DIVISION_NAMES=12U,13U
 *
 * Back up the database before running. Revalidate / redeploy not required for data-only change.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseArgs() {
  return { dryRun: process.argv.includes("--dry-run") };
}

function normDivisionName(s: string): string {
  return s.trim().toUpperCase();
}

async function main() {
  const { dryRun } = parseArgs();
  const sourceSlug = process.env.SOURCE_TOURNAMENT_SLUG ?? "royal-orange-classic-2026";
  const targetSlug = process.env.TARGET_TOURNAMENT_SLUG ?? "12u-13u-2026";
  const targetName =
    process.env.TARGET_TOURNAMENT_NAME ?? "Royal Orange classic 2026 12U-13U";
  const divisionLabels = (process.env.DIVISION_NAMES ?? "12U,13U")
    .split(",")
    .map((s) => normDivisionName(s))
    .filter(Boolean);

  const labelSet = new Set(divisionLabels);

  const source = await prisma.tournament.findFirst({
    where: { slug: { equals: sourceSlug, mode: "insensitive" } },
  });
  if (!source) {
    console.error(`Source tournament not found (slug ~ ${sourceSlug})`);
    process.exit(1);
  }

  const dup = await prisma.tournament.findFirst({
    where: { slug: { equals: targetSlug, mode: "insensitive" } },
  });
  if (dup) {
    console.error(`Target slug already exists: ${dup.slug} (${dup.id})`);
    process.exit(1);
  }

  const divisions = await prisma.division.findMany({
    where: { tournamentId: source.id },
    select: { id: true, name: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });

  const matched = divisions.filter((d) => labelSet.has(normDivisionName(d.name)));
  const missing = divisionLabels.filter(
    (l) => !divisions.some((d) => normDivisionName(d.name) === l),
  );
  if (missing.length > 0) {
    console.error(
      `Missing division(s) by name: ${missing.join(", ")}\n` +
        `Available: ${divisions.map((d) => d.name).join(", ") || "(none)"}`,
    );
    process.exit(1);
  }

  const extra = matched.filter((d) => {
    const n = normDivisionName(d.name);
    const count = divisions.filter((x) => normDivisionName(x.name) === n).length;
    return count > 1;
  });
  if (extra.length > 0) {
    console.error("Ambiguous duplicate division names for requested labels:", extra);
    process.exit(1);
  }

  const movedDivisionIds = matched.map((d) => d.id);

  const pools = await prisma.pool.findMany({
    where: { divisionId: { in: movedDivisionIds } },
    select: { id: true },
  });
  const movedPoolIds = pools.map((p) => p.id);

  const brackets = await prisma.bracket.findMany({
    where: { divisionId: { in: movedDivisionIds } },
    select: { id: true },
  });
  const movedBracketIds = brackets.map((b) => b.id);

  const teams = await prisma.team.findMany({
    where: { poolId: { in: movedPoolIds } },
    select: { id: true },
  });
  const movedTeamIds = teams.map((t) => t.id);

  const gamesToMove = await prisma.game.findMany({
    where: {
      tournamentId: source.id,
      OR: [
        { poolId: { in: movedPoolIds } },
        { bracketId: { in: movedBracketIds } },
        { divisionId: { in: movedDivisionIds } },
      ],
    },
    select: { id: true, fieldId: true, gameKind: true },
  });

  const sourceLocations = await prisma.location.findMany({
    where: { tournamentId: source.id },
    orderBy: { sortOrder: "asc" },
  });
  const sourceFields = await prisma.field.findMany({
    where: { tournamentId: source.id },
    orderBy: [{ locationId: "asc" }, { sortOrder: "asc" }],
  });

  console.log("--- Plan ---");
  console.log(`Source: ${source.name} (${source.slug}) ${source.id}`);
  console.log(`Target name: ${targetName}`);
  console.log(`Target slug: ${targetSlug}`);
  console.log(`Move divisions (${matched.map((d) => d.name).join(", ")}): ${movedDivisionIds.length}`);
  console.log(`Pools: ${movedPoolIds.length}, Teams: ${movedTeamIds.length}, Brackets: ${movedBracketIds.length}`);
  console.log(`Games to move: ${gamesToMove.length}`);
  console.log(`Clone locations: ${sourceLocations.length}, fields: ${sourceFields.length}`);
  console.log(`Dry run: ${dryRun}`);

  if (dryRun) {
    return;
  }

  const {
    id: _dropId,
    createdAt: _dropCreatedAt,
    updatedAt: _dropUpdatedAt,
    ...tournamentScalars
  } = source;
  void _dropId;
  void _dropCreatedAt;
  void _dropUpdatedAt;

  await prisma.$transaction(
    async (tx) => {
      const created = await tx.tournament.create({
        data: {
          ...tournamentScalars,
          name: targetName,
          slug: targetSlug,
          archivedAt: null,
          archiveFolder: null,
          /** List after the source tournament in the public switcher unless admins change it. */
          publicSwitcherOrder: source.publicSwitcherOrder + 10,
        },
      });

      const newTournamentId = created.id;

      const locMap = new Map<string, string>();
      for (const loc of sourceLocations) {
        const row = await tx.location.create({
          data: {
            tournamentId: newTournamentId,
            name: loc.name,
            address: loc.address,
            latitude: loc.latitude,
            longitude: loc.longitude,
            isHeadquarters: loc.isHeadquarters,
            sortOrder: loc.sortOrder,
            mapLink: loc.mapLink,
          },
        });
        locMap.set(loc.id, row.id);
      }

      const fieldMap = new Map<string, string>();
      for (const f of sourceFields) {
        const newLocId = locMap.get(f.locationId);
        if (!newLocId) throw new Error(`Missing location map for field ${f.id}`);
        const row = await tx.field.create({
          data: {
            tournamentId: newTournamentId,
            locationId: newLocId,
            name: f.name,
            sortOrder: f.sortOrder,
          },
        });
        fieldMap.set(f.id, row.id);
      }

      await tx.tournamentSponsorDivision.deleteMany({
        where: { divisionId: { in: movedDivisionIds } },
      });

      await tx.division.updateMany({
        where: { id: { in: movedDivisionIds } },
        data: { tournamentId: newTournamentId },
      });

      await tx.bracket.updateMany({
        where: { id: { in: movedBracketIds } },
        data: { tournamentId: newTournamentId },
      });

      for (const g of gamesToMove) {
        const nf = fieldMap.get(g.fieldId);
        if (!nf) {
          throw new Error(
            `Game ${g.id} uses field ${g.fieldId} not in cloned field set (unexpected)`,
          );
        }
        await tx.game.update({
          where: { id: g.id },
          data: { tournamentId: newTournamentId, fieldId: nf },
        });
      }

      if (movedTeamIds.length > 0) {
        await tx.mediaAsset.updateMany({
          where: { tournamentId: source.id, teamId: { in: movedTeamIds } },
          data: { tournamentId: newTournamentId },
        });
      }
      if (gamesToMove.length > 0) {
        await tx.mediaAsset.updateMany({
          where: {
            tournamentId: source.id,
            gameId: { in: gamesToMove.map((x) => x.id) },
          },
          data: { tournamentId: newTournamentId },
        });
      }

      const faqs = await tx.faqItem.findMany({
        where: { tournamentId: source.id },
      });
      if (faqs.length > 0) {
        await tx.faqItem.createMany({
          data: faqs.map((f) => ({
            tournamentId: newTournamentId,
            question: f.question,
            answer: f.answer,
            sortOrder: f.sortOrder,
            published: f.published,
          })),
        });
      }

      console.log(`Created tournament ${created.id} (${created.slug})`);
    },
    { maxWait: 60_000, timeout: 300_000 },
  );

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
