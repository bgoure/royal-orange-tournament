import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRoundRobinPairings,
  estimateScheduleCapacity,
  expectedRoundRobinGameCount,
  scheduleRoundRobinSlots,
  scheduleRoundRobinSlotsInWindow,
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

describe("scheduleRoundRobinSlotsInWindow", () => {
  it("does not double-book a field at the same time", () => {
    const pairings = buildRoundRobinPairings(["a", "b", "c", "d"]);
    const { slots, warnings } = scheduleRoundRobinSlotsInWindow(pairings, {
      timezone: "UTC",
      startDateYmd: "2026-07-01",
      endDateYmd: "2026-07-01",
      dayStartHm: "08:00",
      dayEndHm: "20:00",
      slotMinutes: 60,
      fieldIds: ["f1"],
    });
    assert.equal(slots.length, 6);
    assert.equal(warnings.length, 0);
    const byKey = new Map<string, number>();
    for (const s of slots) {
      const key = `${s.fieldId}|${s.scheduledAt.toISOString()}`;
      byKey.set(key, (byKey.get(key) ?? 0) + 1);
    }
    for (const n of byKey.values()) {
      assert.equal(n, 1);
    }
  });

  it("warns when capacity is exceeded", () => {
    const pairings = buildRoundRobinPairings(["a", "b", "c", "d", "e", "f"]);
    const { warnings } = scheduleRoundRobinSlotsInWindow(pairings, {
      timezone: "UTC",
      startDateYmd: "2026-07-01",
      endDateYmd: "2026-07-01",
      dayStartHm: "08:00",
      dayEndHm: "09:00",
      slotMinutes: 60,
      fieldIds: ["f1"],
    });
    assert.ok(warnings.length >= 1);
  });
});

describe("estimateScheduleCapacity", () => {
  it("flags when waves exceed available slots", () => {
    const est = estimateScheduleCapacity({
      poolTeamCounts: [4, 4],
      fieldCount: 1,
      timezone: "UTC",
      startDateYmd: "2026-07-01",
      endDateYmd: "2026-07-01",
      dayStartHm: "08:00",
      dayEndHm: "10:00",
      slotMinutes: 90,
    });
    assert.equal(est.fits, false);
    assert.ok(est.warnings.length >= 1);
  });
});
