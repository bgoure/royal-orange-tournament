import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aliveTeamIds,
  losersRoundIndexForWinnersDrop,
} from "@/lib/services/bracket-engine";
import { bidirectionalDeLayout } from "@/lib/brackets/bracket-display";

describe("losersRoundIndexForWinnersDrop", () => {
  it("maps W0→L0, W1→L2, W2→L4 within range", () => {
    assert.equal(losersRoundIndexForWinnersDrop(0, 5), 0);
    assert.equal(losersRoundIndexForWinnersDrop(1, 5), 2);
    assert.equal(losersRoundIndexForWinnersDrop(2, 5), 4);
    assert.equal(losersRoundIndexForWinnersDrop(9, 5), 4);
  });
});

describe("aliveTeamIds", () => {
  it("removes double-elim teams with 2 losses", () => {
    const alive = aliveTeamIds({
      format: "DOUBLE_ELIMINATION",
      entrantTeamIds: ["a", "b", "c", "d"],
      games: [
        {
          status: "FINAL",
          resultType: "REGULAR",
          homeTeamId: "a",
          awayTeamId: "b",
          homeRuns: 5,
          awayRuns: 1,
        },
        {
          status: "FINAL",
          resultType: "REGULAR",
          homeTeamId: "b",
          awayTeamId: "c",
          homeRuns: 0,
          awayRuns: 3,
        },
        {
          status: "FINAL",
          resultType: "REGULAR",
          homeTeamId: "b",
          awayTeamId: "d",
          homeRuns: 1,
          awayRuns: 4,
        },
      ],
    });
    assert.deepEqual(alive.sort(), ["a", "c", "d"]);
  });
});

describe("bidirectionalDeLayout", () => {
  it("places losers left, W0 center, winners+GF right", () => {
    const layout = bidirectionalDeLayout([
      { id: "w0", roundIndex: 0, roundType: "WINNERS" as const },
      { id: "w1", roundIndex: 1, roundType: "WINNERS" as const },
      { id: "l0", roundIndex: 2, roundType: "LOSERS" as const },
      { id: "l1", roundIndex: 3, roundType: "LOSERS" as const },
      { id: "gf", roundIndex: 4, roundType: "FINAL" as const },
    ]);
    assert.equal(layout.center?.id, "w0");
    assert.deepEqual(
      layout.left.map((r) => r.id),
      ["l1", "l0"],
    );
    assert.deepEqual(
      layout.right.map((r) => r.id),
      ["w1", "gf"],
    );
  });
});
