import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRoundRobinPairings,
  expectedRoundRobinGameCount,
  scheduleRoundRobinSlots,
} from "./round-robin-schedule";

describe("buildRoundRobinPairings", () => {
  it("returns empty for fewer than 2 teams", () => {
    assert.deepEqual(buildRoundRobinPairings([]), []);
    assert.deepEqual(buildRoundRobinPairings(["a"]), []);
  });

  it("produces C(n,2) games for even team counts", () => {
    const ids = ["a", "b", "c", "d"];
    const pairings = buildRoundRobinPairings(ids);
    assert.equal(pairings.length, expectedRoundRobinGameCount(4));
    const keys = new Set(pairings.map((p) => [p.homeTeamId, p.awayTeamId].sort().join("|")));
    assert.equal(keys.size, 6);
  });

  it("skips bye slots for odd team counts", () => {
    const ids = ["a", "b", "c"];
    const pairings = buildRoundRobinPairings(ids);
    assert.equal(pairings.length, expectedRoundRobinGameCount(3));
    assert.ok(pairings.every((p) => p.homeTeamId !== "__BYE__" && p.awayTeamId !== "__BYE__"));
    const keys = new Set(pairings.map((p) => [p.homeTeamId, p.awayTeamId].sort().join("|")));
    assert.equal(keys.size, 3);
  });

  it("never pairs a team against itself", () => {
    const pairings = buildRoundRobinPairings(["a", "b", "c", "d", "e"]);
    for (const p of pairings) {
      assert.notEqual(p.homeTeamId, p.awayTeamId);
    }
  });
});

describe("scheduleRoundRobinSlots", () => {
  it("staggers rounds and rotates fields", () => {
    const pairings = buildRoundRobinPairings(["a", "b", "c", "d"]);
    const start = new Date("2026-07-01T14:00:00.000Z");
    const slots = scheduleRoundRobinSlots(pairings, {
      startAt: start,
      slotMinutes: 90,
      fieldIds: ["f1", "f2"],
    });
    assert.equal(slots.length, 6);
    const round0 = slots.filter((s) => s.roundIndex === 0);
    assert.ok(round0.length >= 1);
    assert.ok(round0.every((s) => s.scheduledAt.getTime() === start.getTime()));
    const later = slots.find((s) => s.roundIndex === 1);
    assert.ok(later);
    assert.equal(later!.scheduledAt.getTime(), start.getTime() + 90 * 60_000);
    const fieldsUsed = new Set(slots.map((s) => s.fieldId));
    assert.ok(fieldsUsed.has("f1"));
  });
});
