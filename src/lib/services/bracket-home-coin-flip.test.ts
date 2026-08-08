import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coinFlipHomeAwaySeats } from "./bracket-home-coin-flip";

describe("coinFlipHomeAwaySeats", () => {
  it("leaves seats unchanged when disabled or a side is empty", () => {
    assert.deepEqual(coinFlipHomeAwaySeats("a", "b", false, () => 0.9), {
      homeTeamId: "a",
      awayTeamId: "b",
    });
    assert.deepEqual(coinFlipHomeAwaySeats("a", null, true, () => 0.9), {
      homeTeamId: "a",
      awayTeamId: null,
    });
  });

  it("swaps when enabled and rng is high", () => {
    assert.deepEqual(coinFlipHomeAwaySeats("a", "b", true, () => 0.9), {
      homeTeamId: "b",
      awayTeamId: "a",
    });
  });

  it("keeps order when enabled and rng is low", () => {
    assert.deepEqual(coinFlipHomeAwaySeats("a", "b", true, () => 0.1), {
      homeTeamId: "a",
      awayTeamId: "b",
    });
  });
});
