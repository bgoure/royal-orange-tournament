import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chronologicalRoundColumns } from "./bracket-display";
import {
  gamesForOba5Seeded,
  oba5SeededRoundColumns,
} from "@/lib/services/oba-de-bracket-build";

describe("chronologicalRoundColumns", () => {
  it("splits a two-game FINAL into Round 6 and Round 7 after Round 1–5", () => {
    const rounds = [
      { id: "r1", name: "Round 1", roundIndex: 0, roundType: "WINNERS" as const },
      { id: "r2", name: "Round 2", roundIndex: 1, roundType: "WINNERS" as const },
      { id: "r3", name: "Round 3", roundIndex: 2, roundType: "LOSERS" as const },
      { id: "r4", name: "Round 4", roundIndex: 3, roundType: "LOSERS" as const },
      { id: "r5", name: "Round 5", roundIndex: 4, roundType: "LOSERS" as const },
      { id: "gf", name: "Championship", roundIndex: 5, roundType: "FINAL" as const },
    ];
    const byRound = new Map([
      ["r1", [{ id: "g1", gameNumber: "1", bracketPosition: 0 }]],
      [
        "r2",
        [
          { id: "g2", gameNumber: "2", bracketPosition: 0 },
          { id: "g3", gameNumber: "3", bracketPosition: 1 },
        ],
      ],
      ["r3", [{ id: "g4", gameNumber: "4", bracketPosition: 0 }]],
      [
        "r4",
        [
          { id: "g5", gameNumber: "5", bracketPosition: 0 },
          { id: "g6", gameNumber: "6", bracketPosition: 1 },
        ],
      ],
      ["r5", [{ id: "g7", gameNumber: "7", bracketPosition: 0 }]],
      [
        "gf",
        [
          { id: "g8", gameNumber: "8", bracketPosition: 0 },
          { id: "g9", gameNumber: "9", bracketPosition: 1 },
        ],
      ],
    ]);
    const cols = chronologicalRoundColumns(rounds, byRound);
    assert.deepEqual(
      cols.map((c) => c.label),
      oba5SeededRoundColumns(),
    );
    assert.equal(cols[0]!.games.length, 1);
    assert.equal(cols[1]!.games.length, 2);
    assert.equal(cols[5]!.subtitle, "Championship");
    assert.equal(cols[6]!.subtitle, "If necessary");
  });
});

describe("gamesForOba5Seeded", () => {
  it("opens with seed 4 vs 5; seeds 1–3 enter in Round 2", () => {
    const games = gamesForOba5Seeded(["s1", "s2", "s3", "s4", "s5"]);
    assert.equal(games.filter((g) => g.roundGroup === "R1").length, 1);
    const g1 = games.find((g) => g.key === "G1")!;
    assert.equal(g1.home.kind, "team");
    assert.equal(g1.away.kind, "team");
    if (g1.home.kind === "team") assert.equal(g1.home.teamId, "s4");
    if (g1.away.kind === "team") assert.equal(g1.away.teamId, "s5");
    const r2 = games.filter((g) => g.roundGroup === "R2");
    assert.equal(r2.length, 2);
    assert.ok(r2.some((g) => g.home.kind === "team" && g.home.teamId === "s1"));
    assert.ok(r2.some((g) => g.home.kind === "team" && g.home.teamId === "s2"));
  });
});
