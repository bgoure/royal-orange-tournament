import "dotenv/config";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GameKind, GameStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { applyGameScore } from "@/lib/services/game-score-write";
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

/** Tournament + pool + one LIVE 0–0 game, ready to be scored. */
async function seedScorableGame(label: string) {
  const tourn = await prisma.tournament.create({
    data: {
      name: label,
      slug: `${label}-${Date.now()}`,
      shortLabel: "S",
      startDate: new Date(2026, 6, 1),
      endDate: new Date(2026, 6, 2),
      timezone: "UTC",
      locationLabel: "Test",
      isPublished: true,
    },
  });
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
      gameKind: GameKind.POOL,
      homeRuns: 0,
      awayRuns: 0,
    },
  });
  return { tournamentId: tourn.id, gameId: game.id, updatedAt: game.updatedAt };
}

describe("applyGameScore optimistic concurrency", () => {
  it("lets only one of two simultaneous writers with the same expectedUpdatedAt win", async (t) => {
    if (!run) {
      t.skip("DATABASE_URL not set");
      return;
    }

    const seeded = await seedScorableGame("api-score-race");
    try {
      const base = {
        gameId: seeded.gameId,
        tournamentId: seeded.tournamentId,
        markFinal: true,
        expectedUpdatedAt: seeded.updatedAt,
      };
      const [first, second] = await Promise.all([
        applyGameScore({ ...base, homeRuns: 7, awayRuns: 3 }),
        applyGameScore({ ...base, homeRuns: 1, awayRuns: 9 }),
      ]);

      const winners = [first, second].filter((r) => r.ok);
      const losers = [first, second].filter((r) => !r.ok);
      assert.equal(winners.length, 1, "exactly one writer should be allowed to commit");
      assert.equal(losers.length, 1, "the other writer should be rejected");

      const loser = losers[0]!;
      assert.equal(loser.ok, false);
      assert.equal(loser.ok === false ? loser.reason : null, "conflict");

      const winner = winners[0]!;
      assert.equal(winner.ok, true);

      const stored = await prisma.game.findUniqueOrThrow({ where: { id: seeded.gameId } });
      assert.equal(stored.status, GameStatus.FINAL);
      assert.ok(
        (stored.homeRuns === 7 && stored.awayRuns === 3) ||
          (stored.homeRuns === 1 && stored.awayRuns === 9),
        "stored score should be one writer's score, not a blend of both",
      );
      if (winner.ok) {
        assert.equal(stored.homeRuns, winner.game.homeRuns);
        assert.equal(stored.awayRuns, winner.game.awayRuns);
      }
      // The conflict payload must describe the committed server state so the client can rebase.
      if (loser.ok === false && loser.reason === "conflict") {
        assert.equal(loser.game.homeRuns, stored.homeRuns);
        assert.equal(loser.game.awayRuns, stored.awayRuns);
        assert.equal(loser.game.updatedAt.getTime(), stored.updatedAt.getTime());
      }
      // The token must advance so a retry with the old value cannot slip through.
      assert.ok(stored.updatedAt.getTime() > seeded.updatedAt.getTime());
    } finally {
      await prisma.tournament.delete({ where: { id: seeded.tournamentId } });
    }
  });

  it("rejects a stale expectedUpdatedAt and accepts the refreshed one", async (t) => {
    if (!run) {
      t.skip("DATABASE_URL not set");
      return;
    }

    const seeded = await seedScorableGame("api-score-stale");
    try {
      const first = await applyGameScore({
        gameId: seeded.gameId,
        tournamentId: seeded.tournamentId,
        homeRuns: 2,
        awayRuns: 1,
        markFinal: false,
        expectedUpdatedAt: seeded.updatedAt,
      });
      assert.equal(first.ok, true);

      const stale = await applyGameScore({
        gameId: seeded.gameId,
        tournamentId: seeded.tournamentId,
        homeRuns: 4,
        awayRuns: 4,
        markFinal: false,
        expectedUpdatedAt: seeded.updatedAt,
      });
      assert.equal(stale.ok, false);
      assert.equal(stale.ok === false ? stale.reason : null, "conflict");

      const retry = await applyGameScore({
        gameId: seeded.gameId,
        tournamentId: seeded.tournamentId,
        homeRuns: 4,
        awayRuns: 4,
        markFinal: false,
        expectedUpdatedAt: first.ok ? first.game.updatedAt : null,
      });
      assert.equal(retry.ok, true);

      const stored = await prisma.game.findUniqueOrThrow({ where: { id: seeded.gameId } });
      assert.equal(stored.homeRuns, 4);
      assert.equal(stored.awayRuns, 4);
    } finally {
      await prisma.tournament.delete({ where: { id: seeded.tournamentId } });
    }
  });

  it("recomputes pool standings in the same transaction as the score", async (t) => {
    if (!run) {
      t.skip("DATABASE_URL not set");
      return;
    }

    const seeded = await seedScorableGame("api-score-standings");
    try {
      const written = await applyGameScore({
        gameId: seeded.gameId,
        tournamentId: seeded.tournamentId,
        homeRuns: 6,
        awayRuns: 2,
        markFinal: true,
        expectedUpdatedAt: seeded.updatedAt,
      });
      assert.equal(written.ok, true);
      if (!written.ok) return;

      const standings = await prisma.poolStanding.findMany({
        where: { poolId: written.game.poolId! },
        orderBy: { displayOrder: "asc" },
      });
      assert.equal(standings.length, 2);
      assert.equal(standings[0]!.teamId, written.game.homeTeam!.id);
      assert.equal(standings[0]!.wins, 1);
      assert.equal(standings[1]!.losses, 1);
    } finally {
      await prisma.tournament.delete({ where: { id: seeded.tournamentId } });
    }
  });

  it("reports not-found for a game outside the tournament", async (t) => {
    if (!run) {
      t.skip("DATABASE_URL not set");
      return;
    }

    const seeded = await seedScorableGame("api-score-missing");
    try {
      const result = await applyGameScore({
        gameId: seeded.gameId,
        tournamentId: "some-other-tournament",
        homeRuns: 1,
        awayRuns: 0,
        markFinal: false,
      });
      assert.equal(result.ok, false);
      assert.equal(result.ok === false ? result.reason : null, "not-found");
    } finally {
      await prisma.tournament.delete({ where: { id: seeded.tournamentId } });
    }
  });
});
