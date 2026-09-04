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
    const msg = formatSeedBoardImpactMessage(2);
    assert.match(msg, /2 later-round seats/);
    assert.match(msg, /will not delete the bracket/);
  });
});
