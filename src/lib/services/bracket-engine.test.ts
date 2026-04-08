import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bracketWinnerTeamId,
  collectAdvancingTeamIds,
  isPowerOfTwo,
  singleElimRoundName,
} from "./bracket-engine";

describe("isPowerOfTwo", () => {
  it("validates powers of two", () => {
    assert.equal(isPowerOfTwo(1), true);
    assert.equal(isPowerOfTwo(4), true);
    assert.equal(isPowerOfTwo(3), false);
    assert.equal(isPowerOfTwo(0), false);
  });
});

describe("collectAdvancingTeamIds", () => {
  it("interleaves pool finish ranks", () => {
    const ids = collectAdvancingTeamIds([
      {
        poolSortKey: "a",
        teamsAdvancing: 2,
        standingsRows: [
          { teamId: "a1", displayOrder: 0 },
          { teamId: "a2", displayOrder: 1 },
        ],
      },
      {
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
