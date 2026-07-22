import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  meetingKey,
  pairTeamsAvoidingRematches,
  pickSeatAvoidingRematch,
} from "./rematch-aware-pairing";

/** Deterministic RNG sequence. */
function seqRng(values: number[]) {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe("pairTeamsAvoidingRematches", () => {
  it("pairs with zero rematches when a perfect non-rematch matching exists", () => {
    // A played B; C played D. Optimal: A-C & B-D or A-D & B-C.
    const prior = new Set([meetingKey("A", "B"), meetingKey("C", "D")]);
    const result = pairTeamsAvoidingRematches(["A", "B", "C", "D"], prior, () => 0);
    assert.equal(result.rematchCount, 0);
    assert.equal(result.forced, false);
    assert.equal(result.matchups.length, 2);
    for (const [a, b] of result.matchups) {
      assert.equal(prior.has(meetingKey(a, b)), false);
    }
  });

  it("is forced when every perfect matching has a rematch", () => {
    // Complete graph of prior meetings among 4 teams → any pairing rematches.
    const teams = ["A", "B", "C", "D"];
    const prior = new Set<string>();
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        prior.add(meetingKey(teams[i]!, teams[j]!));
      }
    }
    const result = pairTeamsAvoidingRematches(teams, prior, () => 0);
    assert.equal(result.forced, true);
    assert.equal(result.rematchCount, 2);
  });

  it("minimizes rematches when some are unavoidable", () => {
    // A played B and C. Pairings: A-B + C-D = 1 rematch; A-C + B-D = 1; A-D + B-C = 0.
    const prior = new Set([meetingKey("A", "B"), meetingKey("A", "C")]);
    const result = pairTeamsAvoidingRematches(["A", "B", "C", "D"], prior, () => 0);
    assert.equal(result.rematchCount, 0);
    assert.equal(result.forced, false);
  });

  it("handles odd counts with a bye", () => {
    const result = pairTeamsAvoidingRematches(["A", "B", "C"], new Set(), () => 0);
    assert.equal(result.matchups.length, 1);
    assert.ok(result.byeTeamId);
    assert.equal(result.rematchCount, 0);
  });

  it("randomizes among equally good pairings", () => {
    const prior = new Set<string>();
    const a = pairTeamsAvoidingRematches(["A", "B", "C", "D"], prior, seqRng([0.9, 0.1, 0.5]));
    const b = pairTeamsAvoidingRematches(["A", "B", "C", "D"], prior, seqRng([0.1, 0.9, 0.2]));
    assert.equal(a.rematchCount, 0);
    assert.equal(b.rematchCount, 0);
    // Different RNG streams can pick different matchings (not guaranteed identical).
    assert.equal(a.matchups.length, 2);
    assert.equal(b.matchups.length, 2);
  });
});

describe("pickSeatAvoidingRematch", () => {
  it("prefers a half-open seat that is not a rematch", () => {
    const prior = new Set([meetingKey("T", "X")]);
    const seat = pickSeatAvoidingRematch(
      "T",
      [
        { gameId: "g1", homeTeamId: "X", awayTeamId: null },
        { gameId: "g2", homeTeamId: "Y", awayTeamId: null },
      ],
      prior,
      () => 0,
    );
    assert.deepEqual(seat, { gameId: "g2", side: "away" });
  });

  it("prefers an empty seat over a rematch half-open seat", () => {
    const prior = new Set([meetingKey("T", "X"), meetingKey("T", "Y")]);
    const seat = pickSeatAvoidingRematch(
      "T",
      [
        { gameId: "g1", homeTeamId: "X", awayTeamId: null },
        { gameId: "g2", homeTeamId: null, awayTeamId: null },
      ],
      prior,
      () => 0,
    );
    assert.deepEqual(seat, { gameId: "g2", side: "home" });
  });

  it("falls back to a rematch seat when no empty seats remain", () => {
    const prior = new Set([meetingKey("T", "X")]);
    const seat = pickSeatAvoidingRematch(
      "T",
      [{ gameId: "g1", homeTeamId: "X", awayTeamId: null }],
      prior,
      () => 0,
    );
    assert.deepEqual(seat, { gameId: "g1", side: "away" });
  });
});
