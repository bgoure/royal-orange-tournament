import "dotenv/config";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GameKind, GameStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { listGamesForTournament } from "@/lib/services/games";

const run = Boolean(process.env.DATABASE_URL);

describe("listGamesForTournament status filter", () => {
  it("filters by LIVE status", async (t) => {
    if (!run) {
      t.skip("DATABASE_URL not set");
      return;
    }

    const slug = `api-live-filter-${Date.now()}`;
    const tourn = await prisma.tournament.create({
      data: {
        name: "API live filter",
        slug,
        shortLabel: "A",
        startDate: new Date(2026, 6, 1),
        endDate: new Date(2026, 6, 2),
        timezone: "UTC",
        locationLabel: "Test",
        isPublished: true,
      },
    });

    try {
      const loc = await prisma.location.create({
        data: { tournamentId: tourn.id, name: "L", isHeadquarters: true, sortOrder: 0 },
      });
      const field = await prisma.field.create({
        data: { tournamentId: tourn.id, locationId: loc.id, name: "F1", sortOrder: 0 },
      });
      const div = await prisma.division.create({
        data: { tournamentId: tourn.id, name: "D", sortOrder: 0 },
      });
      const pool = await prisma.pool.create({
        data: { divisionId: div.id, name: "A", sortOrder: 0 },
      });
      const [h, a] = await Promise.all([
        prisma.team.create({ data: { poolId: pool.id, name: "H", seed: 1 } }),
        prisma.team.create({ data: { poolId: pool.id, name: "A", seed: 2 } }),
      ]);
      const sched = new Date(2026, 6, 1, 12, 0, 0);
      await prisma.game.createMany({
        data: [
          {
            tournamentId: tourn.id,
            poolId: pool.id,
            fieldId: field.id,
            homeTeamId: h.id,
            awayTeamId: a.id,
            scheduledAt: sched,
            status: GameStatus.LIVE,
            gameKind: GameKind.POOL,
            homeRuns: 1,
            awayRuns: 0,
          },
          {
            tournamentId: tourn.id,
            poolId: pool.id,
            fieldId: field.id,
            homeTeamId: h.id,
            awayTeamId: a.id,
            scheduledAt: new Date(sched.getTime() + 3600_000),
            status: GameStatus.SCHEDULED,
            gameKind: GameKind.POOL,
          },
        ],
      });

      const live = await listGamesForTournament(tourn.id, { status: GameStatus.LIVE });
      assert.equal(live.length, 1);
      assert.equal(live[0]!.status, GameStatus.LIVE);

      const all = await listGamesForTournament(tourn.id);
      assert.equal(all.length, 2);
    } finally {
      await prisma.tournament.delete({ where: { id: tourn.id } });
    }
  });
});

describe("score expectedUpdatedAt conflict", () => {
  it("detects stale expectedUpdatedAt against Game.updatedAt", async (t) => {
    if (!run) {
      t.skip("DATABASE_URL not set");
      return;
    }

    const slug = `api-score-409-${Date.now()}`;
    const tourn = await prisma.tournament.create({
      data: {
        name: "API score 409",
        slug,
        shortLabel: "S",
        startDate: new Date(2026, 6, 1),
        endDate: new Date(2026, 6, 2),
        timezone: "UTC",
        locationLabel: "Test",
        isPublished: true,
      },
    });

    try {
      const loc = await prisma.location.create({
        data: { tournamentId: tourn.id, name: "L", isHeadquarters: true, sortOrder: 0 },
      });
      const field = await prisma.field.create({
        data: { tournamentId: tourn.id, locationId: loc.id, name: "F1", sortOrder: 0 },
      });
      const div = await prisma.division.create({
        data: { tournamentId: tourn.id, name: "D", sortOrder: 0 },
      });
      const pool = await prisma.pool.create({
        data: { divisionId: div.id, name: "A", sortOrder: 0 },
      });
      const [h, a] = await Promise.all([
        prisma.team.create({ data: { poolId: pool.id, name: "H", seed: 1 } }),
        prisma.team.create({ data: { poolId: pool.id, name: "A", seed: 2 } }),
      ]);
      const game = await prisma.game.create({
        data: {
          tournamentId: tourn.id,
          poolId: pool.id,
          fieldId: field.id,
          homeTeamId: h.id,
          awayTeamId: a.id,
          scheduledAt: new Date(2026, 6, 1, 12, 0, 0),
          status: GameStatus.LIVE,
          homeRuns: 0,
          awayRuns: 0,
        },
      });

      await prisma.game.update({
        where: { id: game.id },
        data: { homeRuns: 5 },
      });
      const fresh = await prisma.game.findUniqueOrThrow({ where: { id: game.id } });
      const staleIso = new Date(fresh.updatedAt.getTime() - 60_000).toISOString();
      assert.ok(fresh.updatedAt.getTime() > Date.parse(staleIso));
    } finally {
      await prisma.tournament.delete({ where: { id: tourn.id } });
    }
  });
});
