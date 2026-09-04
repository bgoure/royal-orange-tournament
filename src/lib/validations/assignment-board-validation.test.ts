import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { savePoolAssignmentsSchema } from "@/lib/validations/pool-assignments";
import { saveBracketRoundZeroSeedingSchema } from "@/lib/validations/bracket-seed-board";
import { poolAssignmentBlockReason } from "@/lib/services/assignment-impact-db";
import {
  UNASSIGNED,
  changedAssignments,
  initialPlacement,
  moveTeamToPool,
  validatePoolPlacement,
} from "@/components/admin/structure/pool-assignment-state";

describe("savePoolAssignmentsSchema", () => {
  it("accepts a valid multi-move payload", () => {
    const parsed = savePoolAssignmentsSchema.safeParse({
      divisionId: "d1",
      assignments: [
        { teamId: "t1", poolId: "p2" },
        { teamId: "t2", poolId: "p1" },
      ],
    });
    assert.equal(parsed.success, true);
  });

  it("rejects duplicate team IDs", () => {
    const parsed = savePoolAssignmentsSchema.safeParse({
      divisionId: "d1",
      assignments: [
        { teamId: "t1", poolId: "p1" },
        { teamId: "t1", poolId: "p2" },
      ],
    });
    assert.equal(parsed.success, false);
  });
});

describe("saveBracketRoundZeroSeedingSchema", () => {
  it("rejects BYE vs BYE and duplicate teams", () => {
    const byeVsBye = saveBracketRoundZeroSeedingSchema.safeParse({
      bracketId: "b1",
      slots: [{ matchId: "m1", home: { bye: true }, away: { bye: true } }],
    });
    assert.equal(byeVsBye.success, false);

    const dup = saveBracketRoundZeroSeedingSchema.safeParse({
      bracketId: "b1",
      slots: [
        { matchId: "m1", home: { teamId: "t1" }, away: { teamId: "t2" } },
        { matchId: "m2", home: { teamId: "t1" }, away: { bye: true } },
      ],
    });
    assert.equal(dup.success, false);
  });

  it("rejects a bye seed that also appears in Round 1", () => {
    const parsed = saveBracketRoundZeroSeedingSchema.safeParse({
      bracketId: "b1",
      slots: [{ matchId: "m1", home: { teamId: "t1" }, away: { teamId: "t2" } }],
      byeSeedTeamIds: ["t1"],
    });
    assert.equal(parsed.success, false);
  });
});

describe("poolAssignmentBlockReason", () => {
  it("allows free moves when no competition data is affected", () => {
    assert.equal(
      poolAssignmentBlockReason({
        lockedGames: 0,
        scheduledGames: 0,
        publishedBracket: false,
        publishedBracketDivisionIds: [],
      }),
      null,
    );
  });

  it("rejects locked structure (scheduled games or published bracket)", () => {
    const msg = poolAssignmentBlockReason({
      lockedGames: 0,
      scheduledGames: 2,
      publishedBracket: true,
      publishedBracketDivisionIds: ["d1"],
    });
    assert.ok(msg);
    assert.match(msg!, /scheduled games/i);
    assert.match(msg!, /published bracket/i);
  });

  it("rejects when live/scored games are present", () => {
    const msg = poolAssignmentBlockReason({
      lockedGames: 1,
      scheduledGames: 0,
      publishedBracket: false,
      publishedBracketDivisionIds: [],
    });
    assert.ok(msg);
    assert.match(msg!, /live or scored/i);
  });
});

describe("pool assignment multi-move consistency", () => {
  const teams = [
    { id: "t1", name: "A", poolId: "p1" },
    { id: "t2", name: "B", poolId: "p1" },
    { id: "t3", name: "C", poolId: "p2" },
  ];

  it("moves A→B and back without duplicate payload entries", () => {
    const base = initialPlacement(teams);
    let next = moveTeamToPool(base, "t1", "p2");
    assert.deepEqual(changedAssignments(base, next, teams), [{ teamId: "t1", poolId: "p2" }]);
    next = moveTeamToPool(next, "t1", "p1");
    assert.deepEqual(changedAssignments(base, next, teams), []);
  });

  it("batches multiple pending moves into one save payload", () => {
    const base = initialPlacement(teams);
    let next = moveTeamToPool(base, "t1", "p2");
    next = moveTeamToPool(next, "t3", "p1");
    const changes = changedAssignments(base, next, teams);
    assert.equal(changes.length, 2);
    assert.deepEqual(
      changes.sort((a, b) => a.teamId.localeCompare(b.teamId)),
      [
        { teamId: "t1", poolId: "p2" },
        { teamId: "t3", poolId: "p1" },
      ],
    );
    const ids = changes.map((c) => c.teamId);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("blocks save while any team remains unassigned", () => {
    const placement = { t1: "p1", t2: UNASSIGNED, t3: "p2" };
    const issues = validatePoolPlacement(placement, teams, [
      { id: "p1", name: "A", capacityHint: 2 },
      { id: "p2", name: "B", capacityHint: 2 },
    ]);
    assert.ok(issues.some((i) => i.kind === "unassigned"));
  });
});
