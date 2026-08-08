import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chronologicalRoundColumns } from "./bracket-display";
import {
  gamesForOba5Seeded,
  gamesForOba6Seeded,
  oba5SeededRoundColumns,
  oba6SeededRoundColumns,
} from "@/lib/services/oba-de-bracket-build";

describe("chronologicalRoundColumns", () => {
  it("splits a two-game FINAL into Round 5 and Round 6 after Round 1–4", () => {
    const rounds = [
      { id: "r1", name: "Round 1", roundIndex: 0, roundType: "WINNERS" as const },
      { id: "r2", name: "Round 2", roundIndex: 1, roundType: "WINNERS" as const },
      { id: "r3", name: "Round 3", roundIndex: 2, roundType: "LOSERS" as const },
      { id: "r4", name: "Round 4", roundIndex: 3, roundType: "LOSERS" as const },
      { id: "gf", name: "Championship", roundIndex: 4, roundType: "FINAL" as const },
    ];
    const byRound = new Map([
      [
        "r1",
        [
          { id: "g1", gameNumber: "1", bracketPosition: 0 },
          { id: "g2", gameNumber: "2", bracketPosition: 1 },
        ],
      ],
      [
        "r2",
        [
          { id: "g3", gameNumber: "3", bracketPosition: 0 },
          { id: "g4", gameNumber: "4", bracketPosition: 1 },
        ],
      ],
      [
        "r3",
        [
          { id: "g5", gameNumber: "5", bracketPosition: 0 },
          { id: "g6", gameNumber: "6", bracketPosition: 1 },
        ],
      ],
      ["r4", [{ id: "g7", gameNumber: "7", bracketPosition: 0 }]],
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
    assert.equal(cols[0]!.games.length, 2);
    assert.equal(cols[1]!.games.length, 2);
    assert.equal(cols[4]!.subtitle, "Championship");
    assert.equal(cols[5]!.subtitle, "Championship (if necessary)");
  });
});

describe("gamesForOba5Seeded", () => {
  it("opens with G1+G2 in Round 1; G3+G4 in Round 2", () => {
    const games = gamesForOba5Seeded(["s1", "s2", "s3", "s4", "s5"]);
    assert.equal(games.filter((g) => g.roundGroup === "R1").length, 2);
    const g1 = games.find((g) => g.key === "G1")!;
    const g2 = games.find((g) => g.key === "G2")!;
    assert.equal(g1.home.kind, "team");
    assert.equal(g1.away.kind, "team");
    if (g1.home.kind === "team") assert.equal(g1.home.teamId, "s4");
    if (g1.away.kind === "team") assert.equal(g1.away.teamId, "s5");
    if (g2.home.kind === "team") assert.equal(g2.home.teamId, "s2");
    if (g2.away.kind === "team") assert.equal(g2.away.teamId, "s3");
    const r2 = games.filter((g) => g.roundGroup === "R2");
    assert.equal(r2.length, 2);
    assert.ok(r2.some((g) => g.key === "G3"));
    assert.ok(r2.some((g) => g.key === "G4"));
    assert.ok(r2.some((g) => g.home.kind === "team" && g.home.teamId === "s1"));
  });
});

describe("gamesForOba6Seeded", () => {
  it("opens with 4v5 and 3v6; seeds 1–2 bye into Round 2 as G3/G4", () => {
    const games = gamesForOba6Seeded(["s1", "s2", "s3", "s4", "s5", "s6"]);
    assert.equal(games.filter((g) => g.roundGroup === "R1").length, 2);
    const g1 = games.find((g) => g.key === "G1")!;
    const g2 = games.find((g) => g.key === "G2")!;
    if (g1.home.kind === "team") assert.equal(g1.home.teamId, "s4");
    if (g1.away.kind === "team") assert.equal(g1.away.teamId, "s5");
    if (g2.home.kind === "team") assert.equal(g2.home.teamId, "s3");
    if (g2.away.kind === "team") assert.equal(g2.away.teamId, "s6");

    const g3 = games.find((g) => g.key === "G3")!;
    const g4 = games.find((g) => g.key === "G4")!;
    assert.equal(g3.home.kind, "team");
    assert.equal(g3.away.kind, "winner");
    if (g3.home.kind === "team") assert.equal(g3.home.teamId, "s1");
    if (g3.away.kind === "winner") assert.equal(g3.away.of, "G1");
    assert.equal(g4.home.kind, "team");
    assert.equal(g4.away.kind, "winner");
    if (g4.home.kind === "team") assert.equal(g4.home.teamId, "s2");
    if (g4.away.kind === "winner") assert.equal(g4.away.of, "G2");

    const g5 = games.find((g) => g.key === "G5")!;
    const g6 = games.find((g) => g.key === "G6")!;
    assert.equal(g5.home.kind, "loser");
    assert.equal(g5.away.kind, "loser");
    if (g5.home.kind === "loser") assert.equal(g5.home.of, "G4");
    if (g5.away.kind === "loser") assert.equal(g5.away.of, "G1");
    if (g6.home.kind === "loser") assert.equal(g6.home.of, "G2");
    if (g6.away.kind === "loser") assert.equal(g6.away.of, "G3");

    assert.equal(games.filter((g) => g.roundGroup === "R2").length, 4);
    assert.deepEqual(oba6SeededRoundColumns(), [
      "Round 1",
      "Round 2",
      "Round 3",
      "Round 4",
      "Round 5",
      "Round 6",
    ]);
  });

  it("wires championship as G10/G11 after G8 vs G9 path", () => {
    const games = gamesForOba6Seeded(["s1", "s2", "s3", "s4", "s5", "s6"]);
    const g9 = games.find((g) => g.key === "G9")!;
    const gf1 = games.find((g) => g.key === "GF1")!;
    assert.equal(g9.home.kind, "winner");
    assert.equal(g9.away.kind, "loser");
    if (g9.home.kind === "winner") assert.equal(g9.home.of, "G7");
    if (g9.away.kind === "loser") assert.equal(g9.away.of, "G8");
    assert.equal(gf1.gameNumber, "10");
    if (gf1.home.kind === "winner") assert.equal(gf1.home.of, "G8");
    if (gf1.away.kind === "winner") assert.equal(gf1.away.of, "G9");
  });
});
