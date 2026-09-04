import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  divisionDeleteConfirmDescription,
  divisionDeleteDangerHint,
  poolDeleteConfirmDescription,
  poolDeleteDangerHint,
} from "./division-destructive-copy";

describe("division destructive copy", () => {
  it("division delete warns that games/results/scores are permanently removed", () => {
    const confirm = divisionDeleteConfirmDescription();
    const danger = divisionDeleteDangerHint();
    for (const text of [confirm, danger]) {
      assert.match(text, /games/i);
      assert.match(text, /results/i);
      assert.match(text, /scores/i);
      assert.match(text, /permanent/i);
    }
  });

  it("pool delete states preconditions and does not claim cascade deletes", () => {
    const confirm = poolDeleteConfirmDescription();
    assert.match(confirm, /empty/i);
    assert.match(confirm, /bracket/i);
    assert.match(confirm, /does not delete teams or games/i);
    assert.doesNotMatch(confirm, /deletes this pool and all teams/i);
    assert.doesNotMatch(confirm, /games referencing/i);

    const withTeams = poolDeleteDangerHint(2);
    assert.match(withTeams, /2 teams/);
    assert.match(withTeams, /Empty the pool/i);
    assert.match(withTeams, /bracket/i);
    assert.doesNotMatch(withTeams, /Deleting removes them/i);

    const empty = poolDeleteDangerHint(0);
    assert.match(empty, /bracket/i);
    assert.match(empty, /does not delete teams or games/i);
  });
});
