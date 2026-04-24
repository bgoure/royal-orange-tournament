import "dotenv/config";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GameKind, GameResultType, GameStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createDivisionPlayoffBracket } from "@/lib/services/bracket-division-build";
import { softResetTournamentProgressForId } from "@/lib/services/tournament-soft-reset";
import { recomputeAllPoolsForTournament } from "@/lib/services/standings";

const run = Boolean(process.env.DATABASE_URL);

describe("softResetTournamentProgressForId", () => {
  it("clears scores, nulls later bracket slots, and restores round 0 from pool standings", async (t) => {
    if (!run) {
      t.skip("DATABASE_URL not set");
      return;
    }

    const slug = `soft-reset-${Date.now()}`;
    const tourn = await prisma.tournament.create({
      data: {
        name: "Soft reset test",
        slug,
        shortLabel: "T",
        startDate: new Date(2026, 5, 1),
        endDate: new Date(2026, 5, 3),
        timezone: "America/Chicago",
        locationLabel: "Test",
        isPublished: false,
      },
    });
    const tournamentId = tourn.id;

    try {
      const loc = await prisma.location.create({
        data: { tournamentId, name: "L", isHeadquarters: true, sortOrder: 0 },
      });
      const field = await prisma.field.create({
        data: { tournamentId, locationId: loc.id, name: "F1", sortOrder: 0 },
      });
      const div = await prisma.division.create({
        data: { tournamentId, name: "D", sortOrder: 0 },
      });
      const poolA = await prisma.pool.create({
        data: { divisionId: div.id, name: "A", sortOrder: 0, teamsAdvancing: 2 },
      });
      const poolB = await prisma.pool.create({
        data: { divisionId: div.id, name: "B", sortOrder: 1, teamsAdvancing: 2 },
      });
      const [a1, a2] = await Promise.all([
        prisma.team.create({ data: { poolId: poolA.id, name: "A1", seed: 1 } }),
        prisma.team.create({ data: { poolId: poolA.id, name: "A2", seed: 2 } }),
      ]);
      const [b1, b2] = await Promise.all([
        prisma.team.create({ data: { poolId: poolB.id, name: "B1", seed: 1 } }),
        prisma.team.create({ data: { poolId: poolB.id, name: "B2", seed: 2 } }),
      ]);
      const sched = new Date(2026, 5, 1, 9, 0, 0);
      await prisma.game.create({
        data: {
          tournamentId,
          poolId: poolA.id,
          fieldId: field.id,
          homeTeamId: a1.id,
          awayTeamId: a2.id,
          scheduledAt: sched,
          status: GameStatus.FINAL,
          homeRuns: 3,
          awayRuns: 1,
        },
      });
      await prisma.game.create({
        data: {
          tournamentId,
          poolId: poolB.id,
          fieldId: field.id,
          homeTeamId: b1.id,
          awayTeamId: b2.id,
          scheduledAt: sched,
          status: GameStatus.FINAL,
          homeRuns: 2,
          awayRuns: 0,
        },
      });
      await recomputeAllPoolsForTournament(tournamentId);

      const bracketId = await createDivisionPlayoffBracket({
        tournamentId,
        divisionId: div.id,
        name: "Playoff",
        fieldId: field.id,
        startsAt: sched,
        firstRound: [
          { home: { poolId: poolA.id, rank: 1 }, away: { poolId: poolB.id, rank: 2 } },
          { home: { poolId: poolB.id, rank: 1 }, away: { poolId: poolA.id, rank: 2 } },
        ],
      });

      const rounds = await prisma.bracketRound.findMany({
        where: { bracketId },
        orderBy: { roundIndex: "asc" },
      });
      const finalGame = await prisma.game.findFirst({
        where: { bracketRoundId: rounds[1]!.id },
      });
      assert(finalGame);
      await prisma.game.update({
        where: { id: finalGame.id },
        data: { homeTeamId: a1.id, awayTeamId: b1.id },
      });

      await softResetTournamentProgressForId(tournamentId);

      const poolGames = await prisma.game.findMany({
        where: { tournamentId, poolId: { not: null } },
      });
      for (const g of poolGames) {
        assert.equal(g.status, GameStatus.SCHEDULED);
        assert.equal(g.homeRuns, null);
        assert.equal(g.awayRuns, null);
        assert.equal(g.resultType, GameResultType.REGULAR);
      }

      const finalAfter = await prisma.game.findFirst({ where: { id: finalGame.id } });
      assert.equal(finalAfter!.homeTeamId, null);
      assert.equal(finalAfter!.awayTeamId, null);

      const saAfter = await prisma.poolStanding.findMany({
        where: { poolId: poolA.id },
        orderBy: { displayOrder: "asc" },
      });
      const sbAfter = await prisma.poolStanding.findMany({
        where: { poolId: poolB.id },
        orderBy: { displayOrder: "asc" },
      });
      const rankAfter = (rows: typeof saAfter, r: number) => rows[r - 1]!.teamId;

      const r0After = await prisma.game.findMany({
        where: { bracketRoundId: rounds[0]!.id },
        orderBy: { bracketPosition: "asc" },
      });
      assert.equal(r0After[0]!.homeTeamId, rankAfter(saAfter, 1));
      assert.equal(r0After[0]!.awayTeamId, rankAfter(sbAfter, 2));
      assert.equal(r0After[1]!.homeTeamId, rankAfter(sbAfter, 1));
      assert.equal(r0After[1]!.awayTeamId, rankAfter(saAfter, 2));
    } finally {
      await prisma.tournament.delete({ where: { id: tournamentId } });
    }
  });

  it("sets CANCELLED and POSTPONED games to SCHEDULED with cleared scores", async (t) => {
    if (!run) {
      t.skip("DATABASE_URL not set");
      return;
    }

    const slug = `soft-reset-meta-${Date.now()}`;
    const tourn = await prisma.tournament.create({
      data: {
        name: "Soft reset meta",
        slug,
        shortLabel: "M",
        startDate: new Date(2026, 5, 1),
        endDate: new Date(2026, 5, 3),
        timezone: "America/Chicago",
        locationLabel: "Test",
        isPublished: false,
      },
    });
    const tournamentId = tourn.id;

    try {
      const loc = await prisma.location.create({
        data: { tournamentId, name: "L", isHeadquarters: true, sortOrder: 0 },
      });
      const field = await prisma.field.create({
        data: { tournamentId, locationId: loc.id, name: "F1", sortOrder: 0 },
      });
      const div = await prisma.division.create({
        data: { tournamentId, name: "D", sortOrder: 0 },
      });
      const pool = await prisma.pool.create({
        data: { divisionId: div.id, name: "P", sortOrder: 0, teamsAdvancing: 2 },
      });
      const [h, a] = await Promise.all([
        prisma.team.create({ data: { poolId: pool.id, name: "H", seed: 1 } }),
        prisma.team.create({ data: { poolId: pool.id, name: "A", seed: 2 } }),
      ]);
      const sched = new Date(2026, 5, 1, 9, 0, 0);
      const cancelled = await prisma.game.create({
        data: {
          tournamentId,
          poolId: pool.id,
          fieldId: field.id,
          homeTeamId: h.id,
          awayTeamId: a.id,
          scheduledAt: sched,
          status: GameStatus.CANCELLED,
          homeRuns: 1,
          awayRuns: 0,
        },
      });
      const postponed = await prisma.game.create({
        data: {
          tournamentId,
          poolId: pool.id,
          fieldId: field.id,
          homeTeamId: h.id,
          awayTeamId: a.id,
          scheduledAt: sched,
          status: GameStatus.POSTPONED,
          homeRuns: 4,
          awayRuns: 2,
        },
      });

      await softResetTournamentProgressForId(tournamentId);

      const c = await prisma.game.findUnique({ where: { id: cancelled.id } });
      const p = await prisma.game.findUnique({ where: { id: postponed.id } });
      assert.equal(c!.status, GameStatus.SCHEDULED);
      assert.equal(c!.homeRuns, null);
      assert.equal(p!.status, GameStatus.SCHEDULED);
      assert.equal(p!.homeRuns, null);
      assert.equal(p!.awayRuns, null);
    } finally {
      await prisma.tournament.delete({ where: { id: tournamentId } });
    }
  });

  it("clears consolation games to scheduled with no scores", async (t) => {
    if (!run) {
      t.skip("DATABASE_URL not set");
      return;
    }

    const slug = `soft-reset-consolation-${Date.now()}`;
    const tourn = await prisma.tournament.create({
      data: {
        name: "Soft reset consolation",
        slug,
        shortLabel: "C",
        startDate: new Date(2026, 5, 1),
        endDate: new Date(2026, 5, 3),
        timezone: "America/Chicago",
        locationLabel: "Test",
        isPublished: false,
      },
    });
    const tournamentId = tourn.id;

    try {
      const loc = await prisma.location.create({
        data: { tournamentId, name: "L", isHeadquarters: true, sortOrder: 0 },
      });
      const field = await prisma.field.create({
        data: { tournamentId, locationId: loc.id, name: "F1", sortOrder: 0 },
      });
      const div = await prisma.division.create({
        data: { tournamentId, name: "D", sortOrder: 0 },
      });
      const pool = await prisma.pool.create({
        data: { divisionId: div.id, name: "P", sortOrder: 0, teamsAdvancing: 2 },
      });
      const [h, a] = await Promise.all([
        prisma.team.create({ data: { poolId: pool.id, name: "H", seed: 1 } }),
        prisma.team.create({ data: { poolId: pool.id, name: "A", seed: 2 } }),
      ]);
      const sched = new Date(2026, 5, 1, 9, 0, 0);
      const consolation = await prisma.game.create({
        data: {
          tournamentId,
          gameKind: GameKind.CONSOLATION,
          divisionId: div.id,
          fieldId: field.id,
          scheduledAt: sched,
          status: GameStatus.FINAL,
          homeRuns: 5,
          awayRuns: 3,
          homeTeamId: h.id,
          awayTeamId: a.id,
          consolationHomePoolId: pool.id,
          consolationHomeRank: 1,
          consolationAwayPoolId: pool.id,
          consolationAwayRank: 2,
        },
      });

      await softResetTournamentProgressForId(tournamentId);

      const after = await prisma.game.findUnique({ where: { id: consolation.id } });
      assert.equal(after!.status, GameStatus.SCHEDULED);
      assert.equal(after!.homeRuns, null);
      assert.equal(after!.awayRuns, null);
      assert.equal(after!.resultType, GameResultType.REGULAR);
    } finally {
      await prisma.tournament.delete({ where: { id: tournamentId } });
    }
  });
});
