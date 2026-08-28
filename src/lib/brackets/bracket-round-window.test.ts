import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  focusWindowRange,
  latestScoredColumnIndex,
} from "./bracket-round-window";

describe("latestScoredColumnIndex", () => {
  it("returns -1 when nothing is scored", () => {
    const cols = [{ games: [{ status: "SCHEDULED" }] }, { games: [{ status: "TBD" }] }];
    assert.equal(latestScoredColumnIndex(cols), -1);
  });

  it("returns the last column that has FINAL or LIVE", () => {
    const cols = [
      { games: [{ status: "FINAL" }] },
      { games: [{ status: "LIVE" }] },
      { games: [{ status: "SCHEDULED" }] },
    ];
    assert.equal(latestScoredColumnIndex(cols), 1);
  });
});

describe("focusWindowRange", () => {
  it("shows the first three columns before any scores", () => {
    assert.deepEqual(focusWindowRange(-1, 8), { lo: 0, hi: 2 });
  });

  it("includes one previous and two upcoming around the active column", () => {
    assert.deepEqual(focusWindowRange(3, 8), { lo: 2, hi: 5 });
  });

  it("clamps at the start and end", () => {
    assert.deepEqual(focusWindowRange(0, 8), { lo: 0, hi: 2 });
    assert.deepEqual(focusWindowRange(7, 8), { lo: 6, hi: 7 });
  });
});
