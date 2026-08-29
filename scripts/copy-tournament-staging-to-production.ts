/**
 * Copy one tournament (and related graph) from Neon staging → production.
 *
 * Uses DATABASE_URL from .env as production, and swaps the host to the staging
 * compute endpoint (same Neon project credentials).
 *
 * Usage:
 *   npx tsx scripts/copy-tournament-staging-to-production.ts
 *   npx tsx scripts/copy-tournament-staging-to-production.ts --slug=coba10u
 *   npx tsx scripts/copy-tournament-staging-to-production.ts --dry-run
 */
import fs from "node:fs";
import { Prisma, PrismaClient } from "@prisma/client";

const STAGING_POOLER_HOST = "ep-lively-base-an923bf5-pooler.c-6.us-east-1.aws.neon.tech";
const DEFAULT_SLUG = "coba10u";

function readDatabaseUrl(): string {
  const env = fs.readFileSync(".env", "utf8");
  const m = env.match(/^DATABASE_URL=(.+)$/m);
  if (!m) throw new Error("DATABASE_URL missing from .env");
  return m[1]!.trim().replace(/^['"]|['"]$/g, "");
}

function parseArgs() {
  const dryRun = process.argv.includes("--dry-run");
  const slugArg = process.argv.find((a) => a.startsWith("--slug="));
  const slug = slugArg ? slugArg.slice("--slug=".length) : DEFAULT_SLUG;
  return { dryRun, slug };
}

function clientFor(url: string) {
  return new PrismaClient({ datasources: { db: { url } } });
}

async function main() {
  const { dryRun, slug } = parseArgs();
  const prodUrl = readDatabaseUrl();
  const stagingUrl = prodUrl.replace(/@[^/]+/, `@${STAGING_POOLER_HOST}`);

  const source = clientFor(stagingUrl);
  const target = clientFor(prodUrl);

  try {
    const tournament = await source.tournament.findFirst({
      where: { slug: { equals: slug, mode: "insensitive" } },
    });
    if (!tournament) {
      console.error(`Tournament not found on staging: ${slug}`);
      process.exit(1);
    }

    const existing = await target.tournament.findFirst({
      where: { slug: { equals: tournament.slug, mode: "insensitive" } },
    });
    if (existing) {
      console.error(
        `Slug already exists on production: ${existing.slug} (${existing.id}). Aborting.`,
      );
      process.exit(1);
    }

    const byId = await target.tournament.findUnique({ where: { id: tournament.id } });
    if (byId) {
      console.error(`Tournament id already on production: ${byId.id}. Aborting.`);
      process.exit(1);
    }

    const locations = await source.location.findMany({
      where: { tournamentId: tournament.id },
    });
    const fields = await source.field.findMany({ where: { tournamentId: tournament.id } });
    const divisions = await source.division.findMany({
      where: { tournamentId: tournament.id },
      orderBy: { sortOrder: "asc" },
    });
    const divisionIds = divisions.map((d) => d.id);
    const pools = await source.pool.findMany({
      where: { divisionId: { in: divisionIds } },
      orderBy: { sortOrder: "asc" },
    });
    const poolIds = pools.map((p) => p.id);
    const teams = await source.team.findMany({ where: { poolId: { in: poolIds } } });
    const teamIds = teams.map((t) => t.id);
    const logos = await source.teamLogo.findMany({ where: { teamId: { in: teamIds } } });
    const standings = await source.poolStanding.findMany({
      where: { poolId: { in: poolIds } },
    });
    const brackets = await source.bracket.findMany({
      where: { tournamentId: tournament.id },
      orderBy: { sortOrder: "asc" },
    });
    const bracketIds = brackets.map((b) => b.id);
    const rounds = await source.bracketRound.findMany({
      where: { bracketId: { in: bracketIds } },
      orderBy: [{ bracketId: "asc" }, { roundIndex: "asc" }],
    });
    const games = await source.game.findMany({
      where: { tournamentId: tournament.id },
      orderBy: { createdAt: "asc" },
    });
    const matches = await source.bracketMatch.findMany({
      where: { bracketRoundId: { in: rounds.map((r) => r.id) } },
      orderBy: [{ bracketRoundId: "asc" }, { matchIndex: "asc" }],
    });
    const announcements = await source.announcement.findMany({
      where: { tournamentId: tournament.id },
    });
    const faqItems = await source.faqItem.findMany({
      where: { tournamentId: tournament.id },
    });
    const headerLogo = await source.gameSheetHeaderLogo.findUnique({
      where: { tournamentId: tournament.id },
    });
    const sponsors = await source.tournamentSponsor.findMany({
      where: { tournamentId: tournament.id },
      orderBy: { sortOrder: "asc" },
    });
    const sponsorDivisions = sponsors.length
      ? await source.tournamentSponsorDivision.findMany({
          where: { sponsorId: { in: sponsors.map((s) => s.id) } },
        })
      : [];

    let organization: Awaited<ReturnType<typeof source.organization.findUnique>> = null;
    if (tournament.organizationId) {
      organization = await source.organization.findUnique({
        where: { id: tournament.organizationId },
      });
    }

    console.log(
      [
        `Copy ${tournament.name} (${tournament.slug})`,
        `  locations=${locations.length} fields=${fields.length}`,
        `  divisions=${divisions.length} pools=${pools.length} teams=${teams.length}`,
        `  logos=${logos.length} standings=${standings.length}`,
        `  brackets=${brackets.length} rounds=${rounds.length}`,
        `  games=${games.length} matches=${matches.length}`,
        `  announcements=${announcements.length} faq=${faqItems.length}`,
        `  headerLogo=${headerLogo ? 1 : 0} sponsors=${sponsors.length}`,
        dryRun ? "  DRY RUN — no writes" : "  writing to production…",
      ].join("\n"),
    );

    if (dryRun) return;

    await target.$transaction(
      async (tx) => {
        if (organization) {
          const orgExists = await tx.organization.findUnique({ where: { id: organization!.id } });
          if (!orgExists) {
            await tx.organization.create({ data: organization! });
          }
        }

        await tx.tournament.create({ data: tournament });

        if (locations.length) await tx.location.createMany({ data: locations });
        if (fields.length) await tx.field.createMany({ data: fields });
        if (divisions.length) await tx.division.createMany({ data: divisions });
        if (pools.length) await tx.pool.createMany({ data: pools });
        if (teams.length) await tx.team.createMany({ data: teams });
        if (standings.length) await tx.poolStanding.createMany({ data: standings });
        if (brackets.length) await tx.bracket.createMany({ data: brackets });
        if (rounds.length) await tx.bracketRound.createMany({ data: rounds });
        if (games.length) await tx.game.createMany({ data: games });

        // Insert matches without self-FKs first, then patch feeders.
        if (matches.length) {
          await tx.bracketMatch.createMany({
            data: matches.map((row) => ({
              ...row,
              homeFromMatchId: null,
              awayFromMatchId: null,
              loserDropMatchId: null,
            })),
          });
          for (const row of matches) {
            if (!row.homeFromMatchId && !row.awayFromMatchId && !row.loserDropMatchId) continue;
            await tx.bracketMatch.update({
              where: { id: row.id },
              data: {
                homeFromMatchId: row.homeFromMatchId,
                awayFromMatchId: row.awayFromMatchId,
                loserDropMatchId: row.loserDropMatchId,
              },
            });
          }
        }

        if (announcements.length) await tx.announcement.createMany({ data: announcements });
        if (faqItems.length) await tx.faqItem.createMany({ data: faqItems });
      },
      { timeout: 180_000, maxWait: 30_000 },
    );

    if (headerLogo) {
      await target.gameSheetHeaderLogo.create({
        data: {
          ...headerLogo,
          data: Buffer.from(headerLogo.data),
        },
      });
    }
    for (const row of sponsors) {
      await target.tournamentSponsor.create({
        data: {
          ...row,
          data: Buffer.from(row.data),
        },
      });
    }
    if (sponsorDivisions.length) {
      await target.tournamentSponsorDivision.createMany({ data: sponsorDivisions });
    }

    // Logos (bytea) outside the main transaction — large payloads.
    for (const row of logos) {
      await target.teamLogo.create({
        data: {
          ...row,
          data: Buffer.from(row.data),
        },
      });
    }

    console.log(`Done. Public path: /${tournament.slug}`);
  } finally {
    await source.$disconnect();
    await target.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Prisma.PrismaClientKnownRequestError ? e.message : e);
  process.exit(1);
});
