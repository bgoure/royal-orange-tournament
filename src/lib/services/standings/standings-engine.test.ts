import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAggregates,
  orderTeamsForPool,
  orderTeamsManualStandings,
  type StandingsGameInput,
} from "./standings-engine";

function final(partial: Omit<StandingsGameInput, "status">): StandingsGameInput {
  return { status: "FINAL", ...partial };
}

describe("orderTeamsManualStandings", () => {
  it("orders by rank then unranked, then name", () => {
    const teams = [
      { id: "c", name: "C" },
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ];
    const ranks = new Map<string, number | null>([
      ["a", 2],
      ["b", 1],
      ["c", null],
    ]);
    const order = orderTeamsManualStandings(teams, ranks);
    assert.deepEqual(order, ["b", "a", "c"]);
  });
});

describe("buildAggregates", () => {
  it("counts wins, points, runs, and innings from FINAL games only", () => {
    const t1 = "team-1";
    const t2 = "team-2";
    const games: StandingsGameInput[] = [
      {
        status: "SCHEDULED",
        resultType: "REGULAR",
        homeTeamId: t1,
        awayTeamId: t2,
        homeRuns: 10,
        awayRuns: 0,
        homeDefensiveInnings: 6,
        awayDefensiveInnings: 6,
        homeOffensiveInnings: null,
        awayOffensiveInnings: null,
      },
      final({
        resultType: "REGULAR",
        homeTeamId: t1,
        awayTeamId: t2,
        homeRuns: 5,
        awayRuns: 2,
        homeDefensiveInnings: 6,
        awayDefensiveInnings: 5,
        homeOffensiveInnings: null,
        awayOffensiveInnings: null,
      }),
    ];
    const aggs = buildAggregates([t1, t2], games);
    assert.equal(aggs.get(t1)!.wins, 1);
    assert.equal(aggs.get(t1)!.points, 2);
    assert.equal(aggs.get(t1)!.runsFor, 5);
    assert.equal(aggs.get(t1)!.runsAgainst, 2);
    assert.equal(aggs.get(t1)!.defensiveInnings, 6);
    assert.equal(aggs.get(t2)!.losses, 1);
  });
});

describe("orderTeamsForPool", () => {
  it("ranks by points first", () => {
    const a = "aaa";
    const b = "bbb";
    const games: StandingsGameInput[] = [
      final({
        resultType: "REGULAR",
        homeTeamId: a,
        awayTeamId: b,
        homeRuns: 2,
        awayRuns: 1,
        homeDefensiveInnings: 4,
        awayDefensiveInnings: 4,
        homeOffensiveInnings: null,
        awayOffensiveInnings: null,
      }),
    ];
    const aggs = buildAggregates([a, b], games);
    const { order } = orderTeamsForPool([a, b], games, aggs, new Map());
    assert.deepEqual(order, [a, b]);
  });

  it("uses head-to-head wins among tied teams before run ratios", () => {
    const a = "alpha";
    const b = "beta";
    const c = "gamma";
    const teamIds = [a, b, c];
    // a sweeps b twice (4 pts from those games); b sweeps c twice so b also has 4 pts.
    // Among {a,b} only: a has 2 wins, b has 0 → head-to-head favors a before overall RA.
    const games: StandingsGameInput[] = [
      final({
        resultType: "REGULAR",
        homeTeamId: a,
        awayTeamId: b,
        homeRuns: 2,
        awayRuns: 1,
        homeDefensiveInnings: 5,
        awayDefensiveInnings: 5,
        homeOffensiveInnings: null,
        awayOffensiveInnings: null,
      }),
      final({
        resultType: "REGULAR",
        homeTeamId: b,
        awayTeamId: a,
        homeRuns: 0,
        awayRuns: 4,
        homeDefensiveInnings: 5,
        awayDefensiveInnings: 5,
        homeOffensiveInnings: null,
        awayOffensiveInnings: null,
      }),
      final({
        resultType: "REGULAR",
        homeTeamId: b,
        awayTeamId: c,
        homeRuns: 6,
        awayRuns: 0,
        homeDefensiveInnings: 5,
        awayDefensiveInnings: 5,
        homeOffensiveInnings: null,
        awayOffensiveInnings: null,
      }),
      final({
        resultType: "REGULAR",
        homeTeamId: c,
        awayTeamId: b,
        homeRuns: 0,
        awayRuns: 3,
        homeDefensiveInnings: 5,
        awayDefensiveInnings: 5,
        homeOffensiveInnings: null,
        awayOffensiveInnings: null,
      }),
    ];
    const aggs = buildAggregates(teamIds, games);
    assert.equal(aggs.get(a)!.points, 4);
    assert.equal(aggs.get(b)!.points, 4);
    assert.equal(aggs.get(c)!.points, 0);
    const { order } = orderTeamsForPool(teamIds, games, aggs, new Map());
    assert.deepEqual(order.slice(0, 2), [a, b]);
    assert.equal(order[2], c);
  });

  it("uses runs-against ratio among tied teams when head-to-head wins match", () => {
    const x = "x-team";
    const y = "y-team";
    const z = "z-team";
    const teamIds = [x, y, z];
    // 3-team cycle: each 1-0 among minileague, 2 pts each and winsAmong = 1 for all
    const games: StandingsGameInput[] = [
      final({
        resultType: "REGULAR",
        homeTeamId: x,
        awayTeamId: y,
        homeRuns: 1,
        awayRuns: 0,
        homeDefensiveInnings: 6,
        awayDefensiveInnings: 3,
        homeOffensiveInnings: null,
        awayOffensiveInnings: null,
      }),
      final({
        resultType: "REGULAR",
        homeTeamId: y,
        awayTeamId: z,
        homeRuns: 1,
        awayRuns: 0,
        homeDefensiveInnings: 10,
        awayDefensiveInnings: 10,
        homeOffensiveInnings: null,
        awayOffensiveInnings: null,
      }),
      final({
        resultType: "REGULAR",
        homeTeamId: z,
        awayTeamId: x,
        homeRuns: 1,
        awayRuns: 0,
        homeDefensiveInnings: 10,
        awayDefensiveInnings: 30,
        homeOffensiveInnings: null,
        awayOffensiveInnings: null,
      }),
    ];
    const aggs = buildAggregates(teamIds, games);
    for (const id of teamIds) assert.equal(aggs.get(id)!.points, 2);
    const { order } = orderTeamsForPool(teamIds, games, aggs, new Map());
    // winsAmong tied at 1; among-group RA/IP lowest for x (1 run / 36 IP vs 1/13 and 1/20)
    assert.equal(order[0], x);
  });

  it("uses runs-against ratio all pool games when among-tied RA ratios still match", () => {
    const lo = "lo_ra"; // lower is lex after hi? we'll use explicit ids
    const hi = "hi_ra";
    const teamIds = [hi, lo];
    // Same points (1 pt tie game against each other)
    const games: StandingsGameInput[] = [
      final({
        resultType: "REGULAR",
        homeTeamId: hi,
        awayTeamId: lo,
        homeRuns: 1,
        awayRuns: 1,
        homeDefensiveInnings: 6,
        awayDefensiveInnings: 6,
        homeOffensiveInnings: null,
        awayOffensiveInnings: null,
      }),
      // lo allowed more runs in a game vs a dummy third team — only for "all games" stats
      final({
        resultType: "REGULAR",
        homeTeamId: lo,
        awayTeamId: "other",
        homeRuns: 0,
        awayRuns: 9,
        homeDefensiveInnings: 9,
        awayDefensiveInnings: 1,
        homeOffensiveInnings: null,
        awayOffensiveInnings: null,
      }),
    ];
    const aggs = buildAggregates([...teamIds, "other"], games);
    const { order } = orderTeamsForPool(teamIds, games, aggs, new Map());
    // Among tied pair only: symmetric 1 RA, 6 DI → still tie on step 2
    // RA all: hi has 1/6 vs lo has 10/15 — hi has lower RA/IP → hi first
    assert.equal(order[0], hi);
  });

  it("applies tiebreakOverrideRank before teamId placeholder", () => {
    const z = "zzz";
    const a = "aaa";
    const games: StandingsGameInput[] = [
      final({
        resultType: "REGULAR",
        homeTeamId: z,
        awayTeamId: a,
        homeRuns: 1,
        awayRuns: 1,
        homeDefensiveInnings: 3,
        awayDefensiveInnings: 3,
        homeOffensiveInnings: null,
        awayOffensiveInnings: null,
      }),
    ];
    const aggs = buildAggregates([z, a], games);
    const overrides = new Map<string, number | null>([
      [z, 2],
      [a, 1],
    ]);
    const { order, usedCoinTossPlaceholder } = orderTeamsForPool(
      [z, a],
      games,
      aggs,
      overrides,
    );
    assert.equal(order[0], a); // lower override rank = better
    assert.equal(usedCoinTossPlaceholder, false);
  });

  it("sets usedCoinTossPlaceholder when teamId breaks an otherwise complete tie", () => {
    const t1 = "m_team";
    const t2 = "z_team";
    const games: StandingsGameInput[] = [
      final({
        resultType: "REGULAR",
        homeTeamId: t1,
        awayTeamId: t2,
        homeRuns: 4,
        awayRuns: 4,
        homeDefensiveInnings: 4,
        awayDefensiveInnings: 4,
        homeOffensiveInnings: 4,
        awayOffensiveInnings: 4,
      }),
    ];
    const aggs = buildAggregates([t1, t2], games);
    const { order, usedCoinTossPlaceholder } = orderTeamsForPool(
      [t2, t1],
      games,
      aggs,
      new Map(),
    );
    assert.equal(usedCoinTossPlaceholder, true);
    assert.deepEqual(order, [t1, t2].sort((x, y) => x.localeCompare(y)));
  });
});
