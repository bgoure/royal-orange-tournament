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
  oba13EndgameBranchForGameNumber,
  oba13PublicEndgameMode,
  oba13PlaceholderPrimary,
  oba13SitOutByeNote,
  oba13Round5ByeTeam,
  oba13Round5RedrawPool,
  oba13Round5Undefeated,
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

describe("oba13 sit-out display helpers", () => {
  it("names the sitting-out team and maps A/B endgame numbers", () => {
    assert.equal(
      oba13SitOutByeNote([
        { gameNumber: OBA13_GAME.BYE_R5, homeTeam: { name: "Hamilton" }, awayTeam: null },
      ]),
      "Bye: Hamilton",
    );
    assert.equal(oba13EndgameBranchForGameNumber("23A"), "A");
    assert.equal(oba13EndgameBranchForGameNumber("25B"), "B");
    assert.equal(oba13EndgameBranchForGameNumber("14"), null);
    assert.equal(
      oba13PublicEndgameMode([{ gameNumber: "23A" }, { gameNumber: "23B" }]),
      "placeholder",
    );
    assert.equal(oba13PublicEndgameMode([{ gameNumber: "23A" }, { gameNumber: "R6 Bye" }]), "A");
    assert.equal(oba13PublicEndgameMode([{ gameNumber: "25B" }]), "B");
  });
});

describe("oba13Round5RedrawPool", () => {
  function finalGame(opts: {
    gameNumber: string;
    homeId: string;
    awayId: string;
    homeName: string;
    awayName: string;
    homeRuns: number;
    awayRuns: number;
  }) {
    return {
      gameNumber: opts.gameNumber,
      status: "FINAL",
      resultType: "REGULAR",
      homeTeamId: opts.homeId,
      awayTeamId: opts.awayId,
      homeRuns: opts.homeRuns,
      awayRuns: opts.awayRuns,
      homeTeam: { name: opts.homeName },
      awayTeam: { name: opts.awayName },
    };
  }

  it("lists Round 4 survivors under Round 5 until seats are filled", () => {
    const games = [
      finalGame({
        gameNumber: "13",
        homeId: "a",
        awayId: "z",
        homeName: "Alpha",
        awayName: "Zulu",
        homeRuns: 5,
        awayRuns: 1,
      }),
      finalGame({
        gameNumber: "18",
        homeId: "b",
        awayId: "c",
        homeName: "Bravo",
        awayName: "Charlie",
        homeRuns: 3,
        awayRuns: 2,
      }),
      finalGame({
        gameNumber: "19",
        homeId: "d",
        awayId: "e",
        homeName: "Delta",
        awayName: "Echo",
        homeRuns: 1,
        awayRuns: 4,
      }),
      finalGame({
        gameNumber: "20",
        homeId: "f",
        awayId: "g",
        homeName: "Foxtrot",
        awayName: "Golf",
        homeRuns: 6,
        awayRuns: 0,
      }),
      {
        gameNumber: "R5 Bye",
        status: "SCHEDULED",
        resultType: "REGULAR",
        homeTeamId: null,
        awayTeamId: null,
        homeRuns: null,
        awayRuns: null,
        homeTeam: null,
        awayTeam: null,
      },
      {
        gameNumber: "21",
        status: "SCHEDULED",
        resultType: "REGULAR",
        homeTeamId: null,
        awayTeamId: null,
        homeRuns: null,
        awayRuns: null,
        homeTeam: null,
        awayTeam: null,
      },
      {
        gameNumber: "22",
        status: "SCHEDULED",
        resultType: "REGULAR",
        homeTeamId: null,
        awayTeamId: null,
        homeRuns: null,
        awayRuns: null,
        homeTeam: null,
        awayTeam: null,
      },
    ];
    const pool = oba13Round5RedrawPool(games);
    assert.ok(pool);
    assert.deepEqual(
      pool!.teams.map((t) => t.teamId).sort(),
      ["a", "b", "e", "f", "g"].sort(),
    );
    assert.equal(pool!.waitingOn.length, 0);
    assert.equal(pool!.teams.find((t) => t.teamId === "a")?.how, "Sat out Round 4");
    assert.equal(pool!.teams.find((t) => t.teamId === "f")?.how, "Winner of Game 20");
    assert.equal(pool!.teams.find((t) => t.teamId === "g")?.how, "Loser of Game 20");
  });

  it("hides the pool once Round 5 bye and both games have teams", () => {
    const games = [
      finalGame({
        gameNumber: "18",
        homeId: "b",
        awayId: "c",
        homeName: "Bravo",
        awayName: "Charlie",
        homeRuns: 3,
        awayRuns: 2,
      }),
      {
        gameNumber: "R5 Bye",
        status: "SCHEDULED",
        resultType: "REGULAR",
        homeTeamId: "a",
        awayTeamId: null,
        homeRuns: null,
        awayRuns: null,
        homeTeam: { name: "Alpha" },
        awayTeam: null,
      },
      {
        gameNumber: "21",
        status: "SCHEDULED",
        resultType: "REGULAR",
        homeTeamId: "b",
        awayTeamId: "e",
        homeRuns: null,
        awayRuns: null,
        homeTeam: { name: "Bravo" },
        awayTeam: { name: "Echo" },
      },
      {
        gameNumber: "22",
        status: "SCHEDULED",
        resultType: "REGULAR",
        homeTeamId: "f",
        awayTeamId: "g",
        homeRuns: null,
        awayRuns: null,
        homeTeam: { name: "Foxtrot" },
        awayTeam: { name: "Golf" },
      },
    ];
    assert.equal(oba13Round5RedrawPool(games), null);
  });
});

describe("oba13 4-0 vs 3-0 endgame lock", () => {
  function finalGame(opts: {
    gameNumber: string;
    homeId: string;
    awayId: string;
    homeName: string;
    awayName: string;
    homeRuns: number;
    awayRuns: number;
  }) {
    return {
      gameNumber: opts.gameNumber,
      status: "FINAL",
      resultType: "REGULAR",
      homeTeamId: opts.homeId,
      awayTeamId: opts.awayId,
      homeRuns: opts.homeRuns,
      awayRuns: opts.awayRuns,
      homeTeam: { name: opts.homeName },
      awayTeam: { name: opts.awayName },
    };
  }

  function openGame(gameNumber: string) {
    return {
      gameNumber,
      status: "SCHEDULED",
      resultType: "REGULAR",
      homeTeamId: null,
      awayTeamId: null,
      homeRuns: null,
      awayRuns: null,
      homeTeam: null,
      awayTeam: null,
    };
  }

  const endgameBothBranches = [
    openGame("23A"),
    openGame("24A"),
    openGame("25A"),
    openGame("23B"),
    openGame("24B"),
    openGame("25B"),
    openGame("21"),
    openGame("22"),
  ];

  it("labels a 4-0 (no prior bye) as the R5 bye and locks Bracket A while 23B is still scheduled", () => {
    const games = [
      finalGame({
        gameNumber: "2",
        homeId: "oak",
        awayId: "p",
        homeName: "Oakville",
        awayName: "Paris",
        homeRuns: 4,
        awayRuns: 1,
      }),
      finalGame({
        gameNumber: "3",
        homeId: "oak",
        awayId: "q",
        homeName: "Oakville",
        awayName: "Quinte",
        homeRuns: 6,
        awayRuns: 0,
      }),
      finalGame({
        gameNumber: "4",
        homeId: "oak",
        awayId: "r",
        homeName: "Oakville",
        awayName: "Richmond",
        homeRuns: 3,
        awayRuns: 2,
      }),
      finalGame({
        gameNumber: "18",
        homeId: "oak",
        awayId: "s",
        homeName: "Oakville",
        awayName: "Sarnia",
        homeRuns: 5,
        awayRuns: 1,
      }),
      {
        gameNumber: "10",
        status: "SCHEDULED",
        resultType: "REGULAR",
        homeTeamId: "t1",
        awayTeamId: "w2",
        homeRuns: null,
        awayRuns: null,
        homeTeam: { name: "Team 1" },
        awayTeam: { name: "Winner 2" },
      },
      ...endgameBothBranches,
    ];
    const bye = oba13Round5ByeTeam(games);
    assert.ok(bye);
    assert.equal(bye!.teamId, "oak");
    assert.equal(bye!.name, "Oakville");
    assert.equal(bye!.wins, 4);
    assert.equal(bye!.losses, 0);
    assert.equal(bye!.priorByeCount, 0);
    assert.equal(oba13PublicEndgameMode(games), "A");
  });

  it("does not treat a 3-0 (R1 bye via G10 home) as the R5 bye; mode stays placeholder until G21 and G22 are final", () => {
    const games = [
      finalGame({
        gameNumber: "10",
        homeId: "ham",
        awayId: "d",
        homeName: "Hamilton",
        awayName: "Durham",
        homeRuns: 5,
        awayRuns: 2,
      }),
      finalGame({
        gameNumber: "16",
        homeId: "ham",
        awayId: "c",
        homeName: "Hamilton",
        awayName: "Cambridge",
        homeRuns: 4,
        awayRuns: 1,
      }),
      finalGame({
        gameNumber: "18",
        homeId: "ham",
        awayId: "a",
        homeName: "Hamilton",
        awayName: "Aurora",
        homeRuns: 3,
        awayRuns: 0,
      }),
      ...endgameBothBranches,
    ];
    const undefeated = oba13Round5Undefeated(games);
    assert.ok(undefeated);
    assert.equal(undefeated!.teamId, "ham");
    assert.equal(undefeated!.wins, 3);
    assert.equal(undefeated!.priorByeCount, 1);
    assert.equal(oba13Round5ByeTeam(games), null);
    assert.equal(oba13PublicEndgameMode(games), "placeholder");
  });

  it("after G21 and G22 are final, 3 alive locks A and 4 alive locks B", () => {
    const threeAlive = [
      finalGame({
        gameNumber: "10",
        homeId: "ham",
        awayId: "d",
        homeName: "Hamilton",
        awayName: "Durham",
        homeRuns: 5,
        awayRuns: 2,
      }),
      finalGame({
        gameNumber: "16",
        homeId: "ham",
        awayId: "c",
        homeName: "Hamilton",
        awayName: "Cambridge",
        homeRuns: 4,
        awayRuns: 1,
      }),
      finalGame({
        gameNumber: "18",
        homeId: "ham",
        awayId: "a",
        homeName: "Hamilton",
        awayName: "Aurora",
        homeRuns: 3,
        awayRuns: 0,
      }),
      finalGame({
        gameNumber: "2",
        homeId: "a",
        awayId: "b",
        homeName: "Aurora",
        awayName: "Barrie",
        homeRuns: 2,
        awayRuns: 1,
      }),
      finalGame({
        gameNumber: "21",
        homeId: "a",
        awayId: "c",
        homeName: "Aurora",
        awayName: "Cambridge",
        homeRuns: 4,
        awayRuns: 3,
      }),
      finalGame({
        gameNumber: "22",
        homeId: "b",
        awayId: "d",
        homeName: "Barrie",
        awayName: "Durham",
        homeRuns: 6,
        awayRuns: 2,
      }),
      openGame("23A"),
      openGame("23B"),
    ];
    assert.equal(oba13Round5ByeTeam(threeAlive), null);
    assert.equal(oba13PublicEndgameMode(threeAlive), "A");

    const fourAlive = [
      ...threeAlive,
      finalGame({
        gameNumber: "3",
        homeId: "a",
        awayId: "e",
        homeName: "Aurora",
        awayName: "Etobicoke",
        homeRuns: 7,
        awayRuns: 1,
      }),
    ];
    assert.equal(oba13PublicEndgameMode(fourAlive), "B");
  });

  it("uses poster slot copy for empty Bracket A seats", () => {
    assert.equal(oba13PlaceholderPrimary("24A", "R6 Bye"), "R6 Bye");
    assert.equal(oba13PlaceholderPrimary("24A", "23A"), "Winner 23A");
    assert.equal(oba13PlaceholderPrimary("25A", "24A"), "Winner 24A");
    assert.equal(oba13PlaceholderPrimary("25A", "R7 Bye"), "R7 Bye Team\nor\nLoser 24A");
    assert.equal(oba13PlaceholderPrimary("23A", "21"), null);
  });
});
