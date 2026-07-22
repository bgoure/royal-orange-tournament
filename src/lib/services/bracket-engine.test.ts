import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bracketWinnerTeamId,
  collectAdvancingTeamIds,
  doubleElimLosersRoundSizes,
  isPowerOfTwo,
  isValidAdvancingTeamCount,
  isValidEntryTeamCount,
  nextPowerOfTwo,
  padSlotsWithByes,
  singleElimRoundName,
  tripleElimL2RoundSizes,
} from "./bracket-engine";

describe("isPowerOfTwo", () => {
  it("validates powers of two", () => {
    assert.equal(isPowerOfTwo(1), true);
    assert.equal(isPowerOfTwo(4), true);
    assert.equal(isPowerOfTwo(3), false);
    assert.equal(isPowerOfTwo(0), false);
  });
});

describe("nextPowerOfTwo / byes", () => {
  it("pads advancing counts", () => {
    assert.equal(nextPowerOfTwo(6), 8);
    assert.equal(nextPowerOfTwo(8), 8);
    assert.equal(isValidAdvancingTeamCount(6), true);
    assert.equal(isValidEntryTeamCount(6), false);
    assert.equal(isValidEntryTeamCount(8), true);
    const { bracketSize, firstRound } = padSlotsWithByes([
      { poolId: "a", rank: 1 },
      { poolId: "a", rank: 2 },
      { poolId: "a", rank: 3 },
      { poolId: "a", rank: 4 },
      { poolId: "a", rank: 5 },
      { poolId: "a", rank: 6 },
    ]);
    assert.equal(bracketSize, 8);
    assert.equal(firstRound.length, 4);
    const byes = firstRound.flatMap((g) => [g.home, g.away]).filter((s) => s.kind === "bye");
    assert.equal(byes.length, 2);
  });
});

describe("collectAdvancingTeamIds", () => {
  it("interleaves pool finish ranks", () => {
    const ids = collectAdvancingTeamIds([
      {
        poolId: "pool-a",
        poolSortKey: "a",
        teamsAdvancing: 2,
        standingsRows: [
          { teamId: "a1", displayOrder: 0 },
          { teamId: "a2", displayOrder: 1 },
        ],
      },
      {
        poolId: "pool-b",
        poolSortKey: "b",
        teamsAdvancing: 2,
        standingsRows: [
          { teamId: "b1", displayOrder: 0 },
          { teamId: "b2", displayOrder: 1 },
        ],
      },
    ]);
    assert.deepEqual(ids, ["a1", "b1", "a2", "b2"]);
  });
});

describe("singleElimRoundName", () => {
  it("labels final rounds", () => {
    assert.equal(singleElimRoundName(0, 3), "Quarterfinals");
    assert.equal(singleElimRoundName(1, 3), "Semifinals");
    assert.equal(singleElimRoundName(2, 3), "Final");
    assert.equal(singleElimRoundName(0, 2), "Semifinals");
    assert.equal(singleElimRoundName(1, 2), "Final");
  });
});

describe("bracketWinnerTeamId", () => {
  it("reads forfeits and runs", () => {
    assert.equal(
      bracketWinnerTeamId({
        status: "FINAL",
        resultType: "FORFEIT_AWAY_WINS",
        homeTeamId: "h",
        awayTeamId: "a",
        homeRuns: 0,
        awayRuns: 0,
      }),
      "a",
    );
    assert.equal(
      bracketWinnerTeamId({
        status: "FINAL",
        resultType: "REGULAR",
        homeTeamId: "h",
        awayTeamId: "a",
        homeRuns: 3,
        awayRuns: 1,
      }),
      "h",
    );
    assert.equal(
      bracketWinnerTeamId({
        status: "FINAL",
        resultType: "REGULAR",
        homeTeamId: "h",
        awayTeamId: "a",
        homeRuns: 2,
        awayRuns: 2,
      }),
      null,
    );
  });
});

describe("doubleElimLosersRoundSizes / tripleElimL2RoundSizes", () => {
  it("ends with a single final game", () => {
    const l1 = doubleElimLosersRoundSizes(8);
    assert.ok(l1.length >= 1);
    assert.equal(l1[l1.length - 1], 1);
    const l2 = tripleElimL2RoundSizes(8);
    assert.equal(l2[l2.length - 1], 1);
  });

  it("scales up for larger fields", () => {
    assert.ok(doubleElimLosersRoundSizes(16).length > doubleElimLosersRoundSizes(8).length);
    assert.ok(sum(doubleElimLosersRoundSizes(16)) > sum(doubleElimLosersRoundSizes(8)));
  });
});

function sum(ns: number[]) {
  return ns.reduce((a, b) => a + b, 0);
}
