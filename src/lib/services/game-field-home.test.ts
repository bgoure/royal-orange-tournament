import assert from "node:assert/strict";
import test from "node:test";
import { GameResultType } from "@prisma/client";
import { applyFieldHomeToScoring, applyFieldHomeToScoringOptional, mapForfeitTypeWhenSwappingSides } from "./game-field-home";

test("mapForfeitTypeWhenSwappingSides toggles home/away forfeit", () => {
  assert.equal(
    mapForfeitTypeWhenSwappingSides(GameResultType.FORFEIT_HOME_WINS),
    GameResultType.FORFEIT_AWAY_WINS,
  );
  assert.equal(
    mapForfeitTypeWhenSwappingSides(GameResultType.FORFEIT_AWAY_WINS),
    GameResultType.FORFEIT_HOME_WINS,
  );
  assert.equal(mapForfeitTypeWhenSwappingSides(GameResultType.REGULAR), GameResultType.REGULAR);
});

test("applyFieldHomeToScoring swaps paired stats when away is field home", () => {
  const merged = applyFieldHomeToScoring("home-id", "away-id", "away-id", {
    homeRuns: 1,
    awayRuns: 4,
    homeDefensiveInnings: 2,
    awayDefensiveInnings: 3,
    homeOffensiveInnings: 5,
    awayOffensiveInnings: 6,
    resultType: GameResultType.FORFEIT_HOME_WINS,
  });
  assert.equal(merged.homeTeamId, "away-id");
  assert.equal(merged.awayTeamId, "home-id");
  assert.equal(merged.homeRuns, 4);
  assert.equal(merged.awayRuns, 1);
  assert.equal(merged.homeDefensiveInnings, 3);
  assert.equal(merged.awayDefensiveInnings, 2);
  assert.equal(merged.homeOffensiveInnings, 6);
  assert.equal(merged.awayOffensiveInnings, 5);
  assert.equal(merged.resultType, GameResultType.FORFEIT_AWAY_WINS);
});

test("applyFieldHomeToScoringOptional leaves sides when field home blank", () => {
  const merged = applyFieldHomeToScoringOptional("h", "a", "", {
    homeRuns: 2,
    awayRuns: 3,
    homeDefensiveInnings: null,
    awayDefensiveInnings: null,
    homeOffensiveInnings: null,
    awayOffensiveInnings: null,
    resultType: GameResultType.REGULAR,
  });
  assert.equal(merged.homeTeamId, "h");
  assert.equal(merged.awayTeamId, "a");
  assert.equal(merged.homeRuns, 2);
  assert.equal(merged.awayRuns, 3);
});
