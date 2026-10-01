import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  espnConnectorGroups,
  espnRoundsHalveCleanly,
} from "@/lib/brackets/espn-bracket-layout";
import type { GameRow } from "@/components/brackets/bracket-types";

function fakeGame(
  id: string,
  matchIndex: number,
  feeders?: { homeFromId?: string; awayFromId?: string },
): GameRow {
  return {
    id,
    bracketMatch: {
      matchIndex,
      homeFromMatch: feeders?.homeFromId
        ? { id: `bm-${feeders.homeFromId}`, matchIndex: 0, game: { id: feeders.homeFromId, gameNumber: null } }
        : null,
      awayFromMatch: feeders?.awayFromId
        ? { id: `bm-${feeders.awayFromId}`, matchIndex: 1, game: { id: feeders.awayFromId, gameNumber: null } }
        : null,
    },
  } as unknown as GameRow;
}

describe("espnRoundsHalveCleanly", () => {
  it("accepts classic 8→4→2→1", () => {
    assert.equal(espnRoundsHalveCleanly([8, 4, 2, 1]), true);
  });

  it("accepts equal consecutive counts (if-necessary)", () => {
    assert.equal(espnRoundsHalveCleanly([2, 1, 1]), true);
  });

  it("rejects irregular jumps", () => {
    assert.equal(espnRoundsHalveCleanly([5, 2, 1]), false);
  });
});

describe("espnConnectorGroups", () => {
  it("pairs power-of-2 feeders when explicit links are missing", () => {
    const earlier = [fakeGame("a", 0), fakeGame("b", 1), fakeGame("c", 2), fakeGame("d", 3)];
    const later = [fakeGame("s1", 0), fakeGame("s2", 1)];
    const groups = espnConnectorGroups(earlier, later);
    assert.deepEqual(
      groups.map((g) => g.fromGameIds),
      [
        ["a", "b"],
        ["c", "d"],
      ],
    );
  });

  it("prefers explicit home/away feeder game ids", () => {
    const earlier = [fakeGame("a", 0), fakeGame("b", 1)];
    const later = [
      fakeGame("final", 0, { homeFromId: "b", awayFromId: "a" }),
    ];
    const groups = espnConnectorGroups(earlier, later);
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0]!.fromGameIds, ["a", "b"]);
    assert.equal(groups[0]!.toGameId, "final");
  });

  it("emits a single-feeder group for a bye path", () => {
    const earlier = [fakeGame("a", 0), fakeGame("b", 1)];
    const later = [fakeGame("semi", 0, { homeFromId: "a" })];
    const groups = espnConnectorGroups(earlier, later);
    assert.deepEqual(groups[0]!.fromGameIds, ["a"]);
  });
});
