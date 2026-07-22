/**
 * Happy-path integration: skeleton → RR → score → bracket → apply seeds → advance.
 * Skips when DATABASE_URL is unset.
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GameKind, GameStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createDivisionPlayoffBracket } from "@/lib/services/bracket-division-build";
import { advanceBracketWinnerFromGame } from "@/lib/services/bracket-advance";
import { resolveBracketTeamsFromStandings } from "@/lib/services/bracket-resolution";
import { buildRoundRobinPairings, scheduleRoundRobinSlots } from "@/lib/services/round-robin-schedule";
import { recomputeAllPoolsForTournament } from "@/lib/services/standings";

const run = Boolean(process.env.DATABASE_URL);

describe("tournament happy path", () => {
  it("create skeleton → generate RR → score → apply seeds → advance bracket", async (t) => {
    if (!run) {
      t.skip("DATABASE_URL not set");
      return;
    }

    const slug = `happy-path-${Date.now()}`;
    const tourn = await prisma.tournament.create({
      data: {
        name: "Happy path",
        slug,
        shortLabel: "H",
        startDate: new Date(2026, 6, 1),
        endDate: new Date(2026, 6, 3),
        timezone: "America/Chicago",
        locationLabel: "Test",
        isPublished: false,
      },
    });

    try {
      const loc = await prisma.location.create({
        data: { tournamentId: tourn.id, name: "Park", isHeadquarters: true, sortOrder: 0 },
      });
      const field = await prisma.field.create({
        data: { tournamentId: tourn.id, locationId: loc.id, name: "F1", sortOrder: 0 },
      });
      const div = await prisma.division.create({
        data: { tournamentId: tourn.id, name: "10U", sortOrder: 0 },
      });
      const pool = await prisma.pool.create({
        data: { divisionId: div.id, name: "A", sortOrder: 0, teamsAdvancing: 4 },
      });
      const teams = await Promise.all(
        ["T1", "T2", "T3", "T4"].map((name, i) =>
          prisma.team.create({ data: { poolId: pool.id, name, seed: i + 1 } }),
        ),
      );
      const pairings = buildRoundRobinPairings(teams.map((x) => x.id));
      const startAt = new Date(2026, 6, 1, 9, 0, 0);
      const slots = scheduleRoundRobinSlots(pairings, {
        startAt,
        slotMinutes: 60,
        fieldIds: [field.id],
      });
      await prisma.game.createMany({
        data: slots.map((s) => ({
          tournamentId: tourn.id,
          poolId: pool.id,
          fieldId: s.fieldId,
          homeTeamId: s.homeTeamId,
          awayTeamId: s.awayTeamId,
          scheduledAt: s.scheduledAt,
          status: GameStatus.SCHEDULED,
          resultType: "REGULAR" as const,
          gameKind: GameKind.POOL,
        })),
      });

      const poolGames = await prisma.game.findMany({
        where: { tournamentId: tourn.id, poolId: pool.id },
        orderBy: { scheduledAt: "asc" },
      });
      assert.equal(poolGames.length, 6);

      for (const g of poolGames) {
        await prisma.game.update({
          where: { id: g.id },
          data: {
            status: GameStatus.FINAL,
            homeRuns: 5,
            awayRuns: 1,
          },
        });
      }
      await recomputeAllPoolsForTournament(tourn.id);

      const bracketId = await createDivisionPlayoffBracket({
        tournamentId: tourn.id,
        divisionId: div.id,
        name: "Playoffs",
        fieldId: field.id,
        startsAt: startAt,
        firstRound: [
          { home: { poolId: pool.id, rank: 1 }, away: { poolId: pool.id, rank: 4 } },
          { home: { poolId: pool.id, rank: 2 }, away: { poolId: pool.id, rank: 3 } },
        ],
      });

      await resolveBracketTeamsFromStandings(bracketId);

      const r0 = await prisma.bracketRound.findFirst({
        where: { bracketId, roundIndex: 0 },
        include: { games: true },
      });
      assert.ok(r0);
      assert.equal(r0.games.length, 2);
      for (const g of r0.games) {
        assert.ok(g.homeTeamId);
        assert.ok(g.awayTeamId);
      }

      const semi = r0.games[0]!;
      await prisma.game.update({
        where: { id: semi.id },
        data: {
          status: GameStatus.FINAL,
          homeRuns: 3,
          awayRuns: 0,
        },
      });
      await advanceBracketWinnerFromGame(semi.id);

      const finalRound = await prisma.bracketRound.findFirst({
        where: { bracketId, roundIndex: 1 },
        include: { games: true },
      });
      assert.ok(finalRound?.games[0]);
      const winnerId = semi.homeRuns! >= 0 ? (await prisma.game.findUnique({ where: { id: semi.id } }))!.homeTeamId : null;
      const finalGame = finalRound!.games[0]!;
      assert.ok(
        finalGame.homeTeamId === winnerId || finalGame.awayTeamId === winnerId,
        "winner advanced into final",
      );
    } finally {
      await prisma.tournament.delete({ where: { id: tourn.id } });
    }
  });
});
