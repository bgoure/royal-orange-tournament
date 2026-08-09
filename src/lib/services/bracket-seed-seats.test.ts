import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveImplicitSeedSeats } from "./bracket-seed-seats";

function seat(opts: {
  roundIndex: number;
  roundName: string;
  matchIndex: number;
  gameNumber: string;
  homeFrom?: string | null;
  awayFrom?: string | null;
  homeTeamId?: string | null;
}) {
  return {
    roundIndex: opts.roundIndex,
    roundName: opts.roundName,
    matchIndex: opts.matchIndex,
    homeFromMatchId: opts.homeFrom ?? null,
    awayFromMatchId: opts.awayFrom ?? null,
    game: {
      id: `g-${opts.gameNumber}`,
      gameNumber: opts.gameNumber,
      homeTeam: opts.homeTeamId
        ? { id: opts.homeTeamId, name: opts.homeTeamId }
        : null,
      awayTeam: null,
    },
  };
}

describe("deriveImplicitSeedSeats", () => {
  it("finds OBA 6-team G3/G4 home bye seeds (away fed from Round 1)", () => {
    const seats = deriveImplicitSeedSeats([
      seat({
        roundIndex: 1,
        roundName: "Round 2",
        matchIndex: 0,
        gameNumber: "3",
        awayFrom: "m-g1",
        homeTeamId: "s1",
      }),
      seat({
        roundIndex: 1,
        roundName: "Round 2",
        matchIndex: 1,
        gameNumber: "4",
        awayFrom: "m-g2",
        homeTeamId: "s2",
      }),
      // Both feeders — not a seed seat
      seat({
        roundIndex: 2,
        roundName: "Round 3",
        matchIndex: 0,
        gameNumber: "8",
        homeFrom: "m-g3",
        awayFrom: "m-g4",
      }),
    ]);
    assert.equal(seats.length, 2);
    assert.equal(seats[0]!.gameNumber, "3");
    assert.equal(seats[0]!.side, "home");
    assert.equal(seats[0]!.label, "Seed 1 → G3 (Round 2)");
    assert.equal(seats[1]!.gameNumber, "4");
    assert.equal(seats[1]!.label, "Seed 2 → G4 (Round 2)");
  });

  it("finds OBA 7-team G5 home bye seed", () => {
    const seats = deriveImplicitSeedSeats([
      seat({
        roundIndex: 1,
        roundName: "Round 2",
        matchIndex: 0,
        gameNumber: "5",
        awayFrom: "m-g1",
      }),
      seat({
        roundIndex: 1,
        roundName: "Round 2",
        matchIndex: 1,
        gameNumber: "6",
        homeFrom: "m-g2",
        awayFrom: "m-g3",
      }),
    ]);
    assert.equal(seats.length, 1);
    assert.equal(seats[0]!.gameNumber, "5");
    assert.equal(seats[0]!.side, "home");
    assert.equal(seats[0]!.label, "Seed 1 → G5 (Round 2)");
  });

  it("finds OBA 5-team G3 home bye seed", () => {
    const seats = deriveImplicitSeedSeats([
      seat({
        roundIndex: 1,
        roundName: "Round 2",
        matchIndex: 0,
        gameNumber: "3",
        awayFrom: "m-g1",
      }),
      seat({
        roundIndex: 1,
        roundName: "Round 2",
        matchIndex: 1,
        gameNumber: "4",
        homeFrom: "m-g1",
        awayFrom: "m-g2",
      }),
    ]);
    assert.equal(seats.length, 1);
    assert.equal(seats[0]!.gameNumber, "3");
  });

  it("ignores open championship if-necessary (neither side fed)", () => {
    const seats = deriveImplicitSeedSeats([
      seat({
        roundIndex: 6,
        roundName: "Championship",
        matchIndex: 1,
        gameNumber: "11",
      }),
    ]);
    assert.equal(seats.length, 0);
  });
});
