import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BracketRoundType, GameKind } from "@prisma/client";
import { gameSheetOpponentPlaceholder } from "./game-sheet-opponent-placeholder";

describe("gameSheetOpponentPlaceholder", () => {
  it("keeps pool games as TBD", () => {
    assert.equal(
      gameSheetOpponentPlaceholder({ gameKind: GameKind.POOL, bracketRound: null }),
      "TBD",
    );
  });

  it("uses Consolation Game for consolation rows", () => {
    assert.equal(
      gameSheetOpponentPlaceholder({ gameKind: GameKind.CONSOLATION, bracketRound: null }),
      "Consolation Game",
    );
  });

  it("maps typical playoff rounds", () => {
    assert.equal(
      gameSheetOpponentPlaceholder({
        gameKind: GameKind.PLAYOFF,
        bracketRound: { name: "Final", roundType: BracketRoundType.FINAL },
      }),
      "Championship Game",
    );
    assert.equal(
      gameSheetOpponentPlaceholder({
        gameKind: GameKind.PLAYOFF,
        bracketRound: { name: "Semifinals", roundType: BracketRoundType.WINNERS },
      }),
      "Semi-Finals",
    );
    assert.equal(
      gameSheetOpponentPlaceholder({
        gameKind: GameKind.PLAYOFF,
        bracketRound: { name: "Quarterfinals", roundType: BracketRoundType.WINNERS },
      }),
      "Quarter-Finals",
    );
    assert.equal(
      gameSheetOpponentPlaceholder({
        gameKind: GameKind.PLAYOFF,
        bracketRound: { name: "Round 1", roundType: BracketRoundType.WINNERS },
      }),
      "Round 1 Game",
    );
  });

  it("falls back when bracket round is missing", () => {
    assert.equal(
      gameSheetOpponentPlaceholder({ gameKind: GameKind.PLAYOFF, bracketRound: null }),
      "Playoff Game",
    );
  });
});
