import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gamesForOba12Draw, oba12DrawRoundColumns } from "@/lib/services/oba-de-bracket-build";
import {
  inferOba12ImplicitByes,
  OBA12_GAME,
  oba12EndgameBranch,
  oba12GamesForUnusedBranch,
  isOba12AlternateEndgameSlot,
  isOba12SitOutGameNumber,
  oba12EndgameBranchForGameNumber,
  oba12PublicEndgameMode,
  oba12Round5RedrawPool,
} from "@/lib/services/oba-de-12";

const ids = Array.from({ length: 12 }, (_, i) => `t${i + 1}`);

describe("gamesForOba12Draw", () => {
  it("wires Round 1–4 from the written map (no R1 bye, W10 sits into G19)", () => {
    const games = gamesForOba12Draw(ids);
    assert.equal(games.filter((g) => g.roundGroup === "R1").length, 6);
    assert.equal(games.filter((g) => g.roundGroup === "R2").length, 6);
    const g1 = games.find((g) => g.key === "G1")!;
    assert.equal(g1.home.kind, "team");
    if (g1.home.kind === "team") assert.equal(g1.home.teamId, "t1");
    const g10 = games.find((g) => g.key === "G10")!;
    assert.equal(g10.home.kind, "winner");
    if (g10.home.kind === "winner") assert.equal(g10.home.of, "G1");
    if (g10.away.kind === "winner") assert.equal(g10.away.of, "G2");
    const g16 = games.find((g) => g.key === "G16")!;
    assert.equal(g16.home.kind, "winner");
    if (g16.home.kind === "winner") assert.equal(g16.home.of, "G11");
    if (g16.away.kind === "winner") assert.equal(g16.away.of, "G12");
    const g19 = games.find((g) => g.key === "G19")!;
    assert.equal(g19.roundGroup, "R4");
    assert.equal(g19.home.kind, "winner");
    if (g19.home.kind === "winner") assert.equal(g19.home.of, "G10");
    if (g19.away.kind === "winner") assert.equal(g19.away.of, "G16");
    assert.ok(!games.some((g) => g.roundGroup === "R3" && g.home.kind === "bye"));
    assert.deepEqual(oba12DrawRoundColumns(), [
      "Round 1",
      "Round 2",
      "Round 3",
      "Round 4",
      "Round 5",
      "Round 6",
      "Round 7",
    ]);
  });

  it("pre-creates open Round 5 seats and both A/B endgames", () => {
    const games = gamesForOba12Draw(ids);
    const r5 = games.filter((g) => g.roundGroup === "R5");
    assert.equal(r5.length, 2);
    assert.ok(r5.every((g) => g.home.kind === "open" && g.away.kind === "open"));
    const g22a = games.find((g) => g.key === "G22A")!;
    assert.equal(g22a.home.kind, "winner");
    if (g22a.home.kind === "winner") assert.equal(g22a.home.of, "G20");
    if (g22a.away.kind === "winner") assert.equal(g22a.away.of, "G21");
    const g23a = games.find((g) => g.key === "G23A")!;
    assert.equal(g23a.home.kind, "winner");
    if (g23a.home.kind === "winner") assert.equal(g23a.home.of, "G22A");
    assert.equal(g23a.away.kind, "loser");
    if (g23a.away.kind === "loser") assert.equal(g23a.away.of, "G22A");
    const g23b = games.find((g) => g.key === "G23B")!;
    assert.equal(g23b.home.kind, "winner");
    if (g23b.home.kind === "winner") assert.equal(g23b.home.of, "G22B");
    if (g23b.away.kind === "winner") assert.equal(g23b.away.of, "BYE_R6");
    assert.ok(games.some((g) => g.key === "G22B" && g.home.kind === "open"));
    assert.ok(games.some((g) => g.key === "BYE_R6" && g.away.kind === "bye"));
  });
});

describe("oba12EndgameBranch", () => {
  it("uses Bracket A at 2 remaining and Bracket B at 3", () => {
    assert.equal(oba12EndgameBranch(2), "A");
    assert.equal(oba12EndgameBranch(3), "B");
    assert.equal(oba12EndgameBranch(4), null);
    assert.ok(oba12GamesForUnusedBranch("A").includes(OBA12_GAME.G22B));
    assert.ok(oba12GamesForUnusedBranch("B").includes(OBA12_GAME.G22A));
  });

  it("treats A-branch and B-branch game numbers as mutually exclusive", () => {
    assert.equal(isOba12AlternateEndgameSlot("22A", "22B"), true);
    assert.equal(isOba12AlternateEndgameSlot("23A", "23B"), true);
    assert.equal(isOba12AlternateEndgameSlot("R6 Bye", "22A"), true);
    assert.equal(isOba12AlternateEndgameSlot("22A", "23A"), false);
    assert.equal(isOba12AlternateEndgameSlot("22A", "20"), false);
  });

  it("identifies the Round 6 bye as a sit-out slot", () => {
    assert.equal(isOba12SitOutGameNumber("R6 Bye"), true);
    assert.equal(isOba12SitOutGameNumber("22A"), false);
    assert.equal(oba12EndgameBranchForGameNumber("22A"), "A");
    assert.equal(oba12EndgameBranchForGameNumber("23B"), "B");
    assert.equal(oba12EndgameBranchForGameNumber("R6 Bye"), "B");
    assert.equal(oba12PublicEndgameMode([{ gameNumber: "22A" }, { gameNumber: "22B" }]), "placeholder");
    assert.equal(oba12PublicEndgameMode([{ gameNumber: "22A" }, { gameNumber: "23A" }]), "A");
    assert.equal(oba12PublicEndgameMode([{ gameNumber: "23B" }]), "B");
  });
});

describe("inferOba12ImplicitByes", () => {
  it("counts W10 sitting Round 3", () => {
    const awards = inferOba12ImplicitByes([], (num) => (num === "10" ? "w10" : null));
    assert.deepEqual(
      awards.map((a) => `${a.teamId}:${a.roundIndex}`),
      ["w10:2"],
    );
  });
});

describe("oba12Round5RedrawPool", () => {
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
        gameNumber: "17",
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
        homeRuns: 6,
        awayRuns: 0,
      }),
      {
        gameNumber: "20",
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
    ];
    const pool = oba12Round5RedrawPool(games);
    assert.ok(pool);
    assert.deepEqual(
      pool!.teams.map((t) => t.teamId).sort(),
      ["a", "b", "d", "e"].sort(),
    );
    assert.equal(pool!.waitingOn.length, 0);
    assert.equal(pool!.teams.find((t) => t.teamId === "d")?.how, "Winner of Game 19");
    assert.equal(pool!.teams.find((t) => t.teamId === "e")?.how, "Loser of Game 19");
  });

  it("hides the pool once both Round 5 games have teams", () => {
    const games = [
      finalGame({
        gameNumber: "17",
        homeId: "a",
        awayId: "z",
        homeName: "Alpha",
        awayName: "Zulu",
        homeRuns: 5,
        awayRuns: 1,
      }),
      {
        gameNumber: "20",
        status: "SCHEDULED",
        resultType: "REGULAR",
        homeTeamId: "a",
        awayTeamId: "b",
        homeRuns: null,
        awayRuns: null,
        homeTeam: { name: "Alpha" },
        awayTeam: { name: "Bravo" },
      },
      {
        gameNumber: "21",
        status: "SCHEDULED",
        resultType: "REGULAR",
        homeTeamId: "d",
        awayTeamId: "e",
        homeRuns: null,
        awayRuns: null,
        homeTeam: { name: "Delta" },
        awayTeam: { name: "Echo" },
      },
    ];
    assert.equal(oba12Round5RedrawPool(games), null);
  });
});
