import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GameKind } from "@prisma/client";
import {
  playoffScheduleBracketCaption,
  playoffScheduleRoundOnlyLabel,
} from "@/lib/brackets/bracket-display";

describe("playoffScheduleRoundOnlyLabel", () => {
  it("returns the round name for non-final rounds", () => {
    assert.equal(
      playoffScheduleRoundOnlyLabel({
        gameKind: GameKind.PLAYOFF,
        bracketRound: { name: "Round 2", roundType: "WINNERS" },
      }),
      "Round 2",
    );
  });

  it("labels a final round Championship", () => {
    assert.equal(
      playoffScheduleRoundOnlyLabel({
        gameKind: GameKind.PLAYOFF,
        bracketRound: { name: "Round 8", roundType: "FINAL" },
      }),
      "Championship",
    );
  });

  it("hides consolation and missing rounds", () => {
    assert.equal(
      playoffScheduleRoundOnlyLabel({
        gameKind: GameKind.CONSOLATION,
        bracketRound: { name: "Round 2", roundType: "WINNERS" },
      }),
      null,
    );
    assert.equal(playoffScheduleRoundOnlyLabel({ gameKind: GameKind.PLAYOFF, bracketRound: null }), null);
  });
});

describe("playoffScheduleBracketCaption", () => {
  it("prefixes the division on the public schedule line", () => {
    assert.equal(
      playoffScheduleBracketCaption({
        gameKind: GameKind.PLAYOFF,
        division: { name: "13U AAA" },
        bracketRound: { name: "Round 2", roundType: "WINNERS" },
        bracketDivision: { name: "13U AAA" },
      }),
      "13U AAA · Round 2",
    );
  });
});
