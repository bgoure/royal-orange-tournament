import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatPoolAssignmentImpactMessage,
  formatSeedBoardImpactMessage,
  isCompetitiveSeatLocked,
} from "./assignment-impact";

describe("isCompetitiveSeatLocked", () => {
  it("locks LIVE and FINAL REGULAR", () => {
    assert.equal(isCompetitiveSeatLocked({ status: "LIVE", resultType: "REGULAR" }), true);
    assert.equal(isCompetitiveSeatLocked({ status: "FINAL", resultType: "REGULAR" }), true);
  });

  it("allows SCHEDULED and FINAL forfeit BYEs", () => {
    assert.equal(isCompetitiveSeatLocked({ status: "SCHEDULED", resultType: "REGULAR" }), false);
    assert.equal(isCompetitiveSeatLocked({ status: "FINAL", resultType: "FORFEIT_HOME_WINS" }), false);
    assert.equal(isCompetitiveSeatLocked({ status: "FINAL", resultType: "FORFEIT_AWAY_WINS" }), false);
  });
});

describe("impact messages", () => {
  it("pool message mentions games and published bracket without auto-reset", () => {
    const msg = formatPoolAssignmentImpactMessage({
      lockedGames: 0,
      scheduledGames: 3,
      publishedBracket: true,
      publishedBracketDivisionIds: ["d1"],
    });
    assert.match(msg, /3 scheduled games/);
    assert.match(msg, /published bracket/);
    assert.match(msg, /Reset the affected competition structure/);
    assert.doesNotMatch(msg, /automatically/i);
  });

  it("seed message describes clearing later seats without deleting the bracket", () => {
    const msg = formatSeedBoardImpactMessage({ clearableSeats: 2, lockedLaterGames: 0 });
    assert.match(msg, /clear 2 later-round seats/);
    assert.match(msg, /unplayed games only/);
    assert.match(msg, /will not delete the bracket/);
    assert.doesNotMatch(msg, /live or scored/);
  });

  it("seed message describes leaving live/scored later-round games unchanged", () => {
    const msg = formatSeedBoardImpactMessage({ clearableSeats: 0, lockedLaterGames: 1 });
    assert.match(msg, /leave 1 live or scored later-round game unchanged/);
    assert.match(msg, /will not be rewritten/);
    assert.match(msg, /will not delete the bracket/);
  });

  it("seed message lists both clearable seats and locked later-round games", () => {
    const msg = formatSeedBoardImpactMessage({ clearableSeats: 3, lockedLaterGames: 2 });
    assert.match(msg, /clear 3 later-round seats/);
    assert.match(msg, /leave 2 live or scored later-round games unchanged/);
    assert.match(msg, /will not delete the bracket/);
  });
});
