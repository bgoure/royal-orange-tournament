import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  UNASSIGNED,
  balancedCapacityHint,
  changedAssignments,
  initialPlacement,
  moveTeamToPool,
  placementsEqual,
  validatePoolPlacement,
} from "./pool-assignment-state";

const teams = [
  { id: "t1", name: "Alpha", poolId: "p1" },
  { id: "t2", name: "Beta", poolId: "p1" },
  { id: "t3", name: "Gamma", poolId: "p2" },
];
const pools = [
  { id: "p1", name: "A", capacityHint: 2 },
  { id: "p2", name: "B", capacityHint: 2 },
];

describe("pool-assignment-state", () => {
  it("tracks dirty moves and changed payload", () => {
    const base = initialPlacement(teams);
    const next = moveTeamToPool(base, "t2", "p2");
    assert.equal(placementsEqual(base, next), false);
    assert.deepEqual(changedAssignments(base, next, teams), [{ teamId: "t2", poolId: "p2" }]);
  });

  it("flags unassigned pending trays before save", () => {
    const placement = { t1: "p1", t2: UNASSIGNED, t3: "p2" };
    const issues = validatePoolPlacement(placement, teams, pools);
    assert.ok(issues.some((i) => i.kind === "unassigned" && i.teamId === "t2"));
  });

  it("balanced capacity hint ceil-divides", () => {
    assert.equal(balancedCapacityHint(5, 2), 3);
    assert.equal(balancedCapacityHint(0, 2), 0);
  });
});
