/**
 * Team deletion integrity: a team that still appears in a game must not be deletable,
 * because `Game.homeTeamId`/`awayTeamId` are `ON DELETE SET NULL` and would otherwise
 * quietly empty that seat. Skips when DATABASE_URL is unset.
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { GameKind, GameStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { findGameReferencingTeam, teamDeletionBlockReason } from "@/lib/services/team-deletion";

const run = Boolean(process.env.DATABASE_URL);
const createdTournamentIds: string[] = [];

after(async () => {
  if (createdTournamentIds.length === 0) return;
  await prisma.tournament.deleteMany({ where: { id: { in: createdTournamentIds } } });
});

async function seedDivision(label: string) {
  const tournament = await prisma.tournament.create({
    data: {
      name: label,
      slug: `${label}-${Date.now()}`,
      shortLabel: "T",
      startDate: new Date(2026, 6, 1),
      endDate: new Date(2026, 6, 2),
      timezone: "UTC",
      locationLabel: "Test",
      isPublished: false,
    },
  });
  createdTournamentIds.push(tournament.id);

  const location = await prisma.location.create({
    data: { tournamentId: tournament.id, name: "L", isHeadquarters: true, sortOrder: 0 },
  });
  const field = await prisma.field.create({
    data: { tournamentId: tournament.id, locationId: location.id, name: "F1", sortOrder: 0 },
  });
  const division = await prisma.division.create({
    data: { tournamentId: tournament.id, name: "D", sortOrder: 0 },
  });
  const pool = await prisma.pool.create({
    data: { divisionId: division.id, name: "A", sortOrder: 0 },
  });
  const [home, away] = await Promise.all([
    prisma.team.create({ data: { poolId: pool.id, name: "Home", seed: 1 } }),
    prisma.team.create({ data: { poolId: pool.id, name: "Away", seed: 2 } }),
  ]);

  return { tournament, field, division, pool, home, away };
}

describe("teamDeletionBlockReason", () => {
  it("allows deleting a team that is not in any game", async (t) => {
    if (!run) {
      t.skip("DATABASE_URL not set");
      return;
    }

    const s = await seedDivision("team-del-free");
    assert.equal(await findGameReferencingTeam(s.home.id, s.tournament.id), null);
    assert.equal(await teamDeletionBlockReason(s.home.id, s.tournament.id), null);

    await prisma.team.delete({ where: { id: s.home.id } });
    assert.equal(await prisma.team.findUnique({ where: { id: s.home.id } }), null);
  });

  it("blocks a team scheduled in a pool game and keeps the game intact", async (t) => {
    if (!run) {
      t.skip("DATABASE_URL not set");
      return;
    }

    const s = await seedDivision("team-del-pool");
    const game = await prisma.game.create({
      data: {
        tournamentId: s.tournament.id,
        poolId: s.pool.id,
        fieldId: s.field.id,
        homeTeamId: s.home.id,
        awayTeamId: s.away.id,
        scheduledAt: new Date(2026, 6, 1, 9, 0, 0),
        status: GameStatus.FINAL,
        gameKind: GameKind.POOL,
        homeRuns: 5,
        awayRuns: 3,
      },
    });

    const reference = await findGameReferencingTeam(s.home.id, s.tournament.id);
    assert.deepEqual(reference, { gameId: game.id, kind: "pool" });

    const reason = await teamDeletionBlockReason(s.home.id, s.tournament.id);
    assert.ok(reason?.includes("scheduled in at least one game"));

    // The away seat is guarded too, not just the home seat.
    assert.ok(await teamDeletionBlockReason(s.away.id, s.tournament.id));

    const stillThere = await prisma.game.findUniqueOrThrow({ where: { id: game.id } });
    assert.equal(stillThere.homeTeamId, s.home.id);
    assert.equal(stillThere.homeRuns, 5);
  });

  it("blocks a team seeded into a bracket game with a playoff-specific message", async (t) => {
    if (!run) {
      t.skip("DATABASE_URL not set");
      return;
    }

    const s = await seedDivision("team-del-bracket");
    const bracket = await prisma.bracket.create({
      data: { tournamentId: s.tournament.id, divisionId: s.division.id, name: "Playoffs" },
    });
    const round = await prisma.bracketRound.create({
      data: { bracketId: bracket.id, name: "Final", roundIndex: 0 },
    });
    const game = await prisma.game.create({
      data: {
        tournamentId: s.tournament.id,
        fieldId: s.field.id,
        bracketId: bracket.id,
        bracketRoundId: round.id,
        homeTeamId: s.home.id,
        awayTeamId: s.away.id,
        scheduledAt: new Date(2026, 6, 2, 9, 0, 0),
        status: GameStatus.SCHEDULED,
        gameKind: GameKind.PLAYOFF,
      },
    });

    const reference = await findGameReferencingTeam(s.home.id, s.tournament.id);
    assert.deepEqual(reference, { gameId: game.id, kind: "bracket" });

    const reason = await teamDeletionBlockReason(s.home.id, s.tournament.id);
    assert.ok(reason?.includes("playoff game"));
  });

  it("prefers the bracket message when a team is in both pool and bracket games", async (t) => {
    if (!run) {
      t.skip("DATABASE_URL not set");
      return;
    }

    const s = await seedDivision("team-del-both");
    await prisma.game.create({
      data: {
        tournamentId: s.tournament.id,
        poolId: s.pool.id,
        fieldId: s.field.id,
        homeTeamId: s.home.id,
        awayTeamId: s.away.id,
        scheduledAt: new Date(2026, 6, 1, 9, 0, 0),
        status: GameStatus.FINAL,
        gameKind: GameKind.POOL,
        homeRuns: 4,
        awayRuns: 1,
      },
    });
    const bracket = await prisma.bracket.create({
      data: { tournamentId: s.tournament.id, divisionId: s.division.id, name: "Playoffs" },
    });
    await prisma.game.create({
      data: {
        tournamentId: s.tournament.id,
        fieldId: s.field.id,
        bracketId: bracket.id,
        homeTeamId: s.home.id,
        scheduledAt: new Date(2026, 6, 2, 9, 0, 0),
        status: GameStatus.SCHEDULED,
        gameKind: GameKind.PLAYOFF,
      },
    });

    const reference = await findGameReferencingTeam(s.home.id, s.tournament.id);
    assert.equal(reference?.kind, "bracket");
    assert.ok((await teamDeletionBlockReason(s.home.id, s.tournament.id))?.includes("playoff game"));
  });
});
