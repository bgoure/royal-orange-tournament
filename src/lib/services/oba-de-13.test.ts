import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gamesForOba13Draw, oba13DrawRoundColumns } from "@/lib/services/oba-de-bracket-build";
import {
  applyImplicitByeAwards,
  inferOba13ImplicitByes,
  OBA13_GAME,
  oba13EndgameBranch,
  oba13GamesForUnusedBranch,
  isOba13AlternateEndgameSlot,
  isOba13SitOutGameNumber,
  suggestOba13OddRoundPairing,
} from "@/lib/services/oba-de-13";
import type { ObaByeCandidate } from "@/lib/services/oba-bye-award";

const ids = Array.from({ length: 13 }, (_, i) => `t${i + 1}`);

function cand(
  teamId: string,
  bracketLosses: number,
  byeCount: number,
  hadByeInPreviousRound: boolean,
): ObaByeCandidate {
  return { teamId, bracketLosses, byeCount, hadByeInPreviousRound };
}

describe("gamesForOba13Draw", () => {
  it("wires Round 1–4 from the written map (W1 bye, Team 1 vs W2)", () => {
    const games = gamesForOba13Draw(ids);
    assert.equal(games.filter((g) => g.roundGroup === "R1").length, 6);
    assert.equal(games.filter((g) => g.roundGroup === "R2").length, 6);
    const g1 = games.find((g) => g.key === "G1")!;
    assert.equal(g1.home.kind, "team");
    if (g1.home.kind === "team") assert.equal(g1.home.teamId, "t2");
    const g10 = games.find((g) => g.key === "G10")!;
    assert.equal(g10.home.kind, "team");
    if (g10.home.kind === "team") assert.equal(g10.home.teamId, "t1");
    assert.equal(g10.away.kind, "winner");
    if (g10.away.kind === "winner") assert.equal(g10.away.of, "G2");
    const g16 = games.find((g) => g.key === "G16")!;
    assert.equal(g16.home.kind, "winner");
    if (g16.home.kind === "winner") assert.equal(g16.home.of, "G1");
    if (g16.away.kind === "winner") assert.equal(g16.away.of, "G10");
    const g7 = games.find((g) => g.key === "G7")!;
    assert.equal(g7.home.kind, "loser");
    if (g7.home.kind === "loser") assert.equal(g7.home.of, "G1");
    assert.ok(games.every((g) => g.roundName.startsWith("Round")));
    assert.deepEqual(oba13DrawRoundColumns(), [
      "Round 1",
      "Round 2",
      "Round 3",
      "Round 4",
      "Round 5",
      "Round 6",
      "Round 7",
      "Round 8",
    ]);
  });

  it("pre-creates open Round 5 seats and both A/B endgames", () => {
    const games = gamesForOba13Draw(ids);
    const r5 = games.filter((g) => g.roundGroup === "R5");
    assert.equal(r5.length, 3);
    assert.ok(r5.some((g) => g.key === "BYE_R5" && g.away.kind === "bye" && g.home.kind === "open"));
    assert.ok(games.some((g) => g.key === "G23A" && g.home.kind === "open"));
    assert.ok(games.some((g) => g.key === "G23B" && g.home.kind === "open"));
    assert.ok(games.some((g) => g.key === "G25B"));
    assert.ok(games.some((g) => g.key === "G25A"));
    const g24a = games.find((g) => g.key === "G24A")!;
    assert.equal(g24a.home.kind, "winner");
    if (g24a.home.kind === "winner") assert.equal(g24a.home.of, "G23A");
    if (g24a.away.kind === "winner") assert.equal(g24a.away.of, "BYE_R6");
  });
});

describe("oba13EndgameBranch", () => {
  it("uses Bracket A at 3 remaining and Bracket B at 4", () => {
    assert.equal(oba13EndgameBranch(3), "A");
    assert.equal(oba13EndgameBranch(4), "B");
    assert.equal(oba13EndgameBranch(5), null);
    assert.ok(oba13GamesForUnusedBranch("A").includes(OBA13_GAME.G23B));
    assert.ok(oba13GamesForUnusedBranch("B").includes(OBA13_GAME.G23A));
  });

  it("treats A-branch and B-branch game numbers as mutually exclusive", () => {
    assert.equal(isOba13AlternateEndgameSlot("23A", "23B"), true);
    assert.equal(isOba13AlternateEndgameSlot("24A", "24B"), true);
    assert.equal(isOba13AlternateEndgameSlot("25A", "23B"), true);
    assert.equal(isOba13AlternateEndgameSlot("R6 Bye", "23B"), true);
    assert.equal(isOba13AlternateEndgameSlot("23A", "24A"), false);
    assert.equal(isOba13AlternateEndgameSlot("23A", "21"), false);
  });

  it("identifies R5/R6/R7 bye rows as sit-out slots, not matchups", () => {
    assert.equal(isOba13SitOutGameNumber("R5 Bye"), true);
    assert.equal(isOba13SitOutGameNumber("R6 Bye"), true);
    assert.equal(isOba13SitOutGameNumber("R7 Bye"), true);
    assert.equal(isOba13SitOutGameNumber("23A"), false);
  });
});

describe("13-team RP5.2 bye suggestion", () => {
  it("gives the Round 5 bye to the 4-0 undefeated (no prior bye)", () => {
    const remaining = ["u", "a", "b", "c", "d"];
    const candidates = [
      cand("u", 0, 0, false),
      cand("a", 1, 1, true),
      cand("b", 1, 0, false),
      cand("c", 1, 0, false),
      cand("d", 1, 1, false),
    ];
    const s = suggestOba13OddRoundPairing(remaining, candidates, [], new Set(), () => 0);
    assert.equal(s.byeTeamId, "u");
    assert.equal(s.matchups.length, 2);
  });

  it("does not give a 3-0 undefeated a second bye while others have none", () => {
    const remaining = ["u", "a", "b", "c", "d"];
    const candidates = [
      cand("u", 0, 1, false),
      cand("a", 1, 0, false),
      cand("b", 1, 0, false),
      cand("c", 1, 1, true),
      cand("d", 1, 1, false),
    ];
    const s = suggestOba13OddRoundPairing(remaining, candidates, [], new Set(), () => 0);
    assert.notEqual(s.byeTeamId, "u");
    assert.ok(s.byeTeamId === "a" || s.byeTeamId === "b");
  });
});

describe("inferOba13ImplicitByes", () => {
  it("counts Team 1, W1, and W13 sit-outs", () => {
    const awards = inferOba13ImplicitByes(
      [
        {
          gameNumber: OBA13_GAME.G10,
          homeTeamId: "t1",
          awayTeamId: "w2",
          status: "SCHEDULED",
          resultType: "REGULAR",
          homeRuns: null,
          awayRuns: null,
        },
      ],
      (num) => (num === "1" ? "w1" : num === "13" ? "w13" : null),
    );
    assert.deepEqual(
      awards.map((a) => `${a.teamId}:${a.roundIndex}`).sort(),
      ["t1:0", "w1:1", "w13:3"].sort(),
    );
    const merged = applyImplicitByeAwards(
      [cand("t1", 0, 0, false), cand("w13", 1, 0, false)],
      awards,
      4,
    );
    const t1 = merged.find((c) => c.teamId === "t1")!;
    const w13 = merged.find((c) => c.teamId === "w13")!;
    assert.equal(t1.byeCount, 1);
    assert.equal(t1.hadByeInPreviousRound, false);
    assert.equal(w13.byeCount, 1);
    assert.equal(w13.hadByeInPreviousRound, true);
  });
});
