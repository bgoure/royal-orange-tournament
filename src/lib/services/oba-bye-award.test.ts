import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { selectObaByeRecipient, type ObaByeCandidate } from "./oba-bye-award";
import type { StandingsGameInput } from "@/lib/services/standings/standings-engine";

function cand(
  teamId: string,
  bracketLosses: number,
  byeCount: number,
  hadByeInPreviousRound: boolean,
): ObaByeCandidate {
  return { teamId, bracketLosses, byeCount, hadByeInPreviousRound };
}

describe("selectObaByeRecipient", () => {
  it("never awards back-to-back bye when another team is eligible", () => {
    const bye = selectObaByeRecipient(
      [cand("A", 0, 1, true), cand("B", 0, 0, false), cand("C", 1, 0, false)],
      [],
      () => 0,
    );
    assert.notEqual(bye, "A");
    assert.ok(bye === "B" || bye === "C");
  });

  it("does not give a second bye until all have a first", () => {
    const bye = selectObaByeRecipient(
      [cand("A", 1, 1, false), cand("B", 1, 0, false), cand("C", 1, 0, false)],
      [],
      () => 0,
    );
    assert.ok(bye === "B" || bye === "C");
  });

  it("prefers undefeated among eligible", () => {
    const bye = selectObaByeRecipient(
      [cand("A", 0, 0, false), cand("B", 1, 0, false), cand("C", 1, 0, false)],
      [],
      () => 0,
    );
    assert.equal(bye, "A");
  });

  it("uses RP7.3 when multiple undefeated with equal bye history", () => {
    // A beat B head-to-head → A should get bye among two undefeated
    const games: StandingsGameInput[] = [
      {
        status: "FINAL",
        resultType: "REGULAR",
        homeTeamId: "A",
        awayTeamId: "B",
        homeRuns: 5,
        awayRuns: 1,
        homeDefensiveInnings: 6,
        awayDefensiveInnings: 6,
        homeOffensiveInnings: 6,
        awayOffensiveInnings: 6,
      },
    ];
    const bye = selectObaByeRecipient(
      [cand("A", 0, 0, false), cand("B", 0, 0, false)],
      games,
      () => 0,
    );
    assert.equal(bye, "A");
  });
});
