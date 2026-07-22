import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRoundRobinPairings,
  emptySchedulePackingCursor,
  estimateScheduleCapacity,
  expectedRoundRobinGameCount,
  scheduleRoundRobinSlots,
  scheduleRoundRobinSlotsInWindow,
  travelMinutesBetween,
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

  it("staggers overflow waves when a round has more games than fields", () => {
    const pairings = buildRoundRobinPairings(["a", "b", "c", "d"]);
    const start = new Date("2026-07-01T14:00:00.000Z");
    const slots = scheduleRoundRobinSlots(pairings, {
      startAt: start,
      slotMinutes: 90,
      fieldIds: ["f1"],
    });
    assert.equal(slots.length, 6);
    const byKey = new Map<string, number>();
    for (const s of slots) {
      const key = `${s.fieldId}|${s.scheduledAt.toISOString()}`;
      byKey.set(key, (byKey.get(key) ?? 0) + 1);
    }
    for (const n of byKey.values()) {
      assert.equal(n, 1);
    }
  });
});

const baseWindow = {
  timezone: "UTC",
  startDateYmd: "2026-07-01",
  endDateYmd: "2026-07-02",
  dayStartHm: "08:00",
  dayEndHm: "20:00",
  slotMinutes: 60,
  gameDurationMinutes: 50,
  minRestMinutes: 20,
  travelMinutesBetweenFields: 15,
  fieldIds: ["f1", "f2"],
};

describe("scheduleRoundRobinSlotsInWindow", () => {
  it("does not double-book a field at the same time", () => {
    const pairings = buildRoundRobinPairings(["a", "b", "c", "d"]);
    const { slots } = scheduleRoundRobinSlotsInWindow(pairings, {
      ...baseWindow,
      fieldIds: ["f1"],
      endDateYmd: "2026-07-01",
    });
    assert.equal(slots.length, 6);
    const byKey = new Map<string, number>();
    for (const s of slots) {
      const key = `${s.fieldId}|${s.scheduledAt.toISOString()}`;
      byKey.set(key, (byKey.get(key) ?? 0) + 1);
    }
    for (const n of byKey.values()) {
      assert.equal(n, 1);
    }
  });

  it("honors rest and travel when a team switches fields", () => {
    const pairings = buildRoundRobinPairings(["a", "b", "c", "d"]);
    const { slots } = scheduleRoundRobinSlotsInWindow(pairings, {
      ...baseWindow,
      fieldIds: ["f1", "f2"],
      minRestMinutes: 30,
      travelMinutesBetweenFields: 45,
      gameDurationMinutes: 60,
      slotMinutes: 60,
    });
    assert.equal(slots.length, 6);
    const byTeam = new Map<string, typeof slots>();
    for (const s of slots) {
      for (const t of [s.homeTeamId, s.awayTeamId]) {
        const list = byTeam.get(t) ?? [];
        list.push(s);
        byTeam.set(t, list);
      }
    }
    for (const teamSlots of byTeam.values()) {
      teamSlots.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
      for (let i = 1; i < teamSlots.length; i++) {
        const prev = teamSlots[i - 1]!;
        const cur = teamSlots[i]!;
        const prevEnd = prev.scheduledAt.getTime() + 60 * 60_000;
        const travel = prev.fieldId !== cur.fieldId ? 45 : 0;
        const ready = prevEnd + (30 + travel) * 60_000;
        assert.ok(
          cur.scheduledAt.getTime() >= ready,
          `team gap too small: ${cur.scheduledAt.toISOString()} vs ready ${new Date(ready).toISOString()}`,
        );
      }
    }
  });

  it("warns when capacity is exceeded", () => {
    const pairings = buildRoundRobinPairings(["a", "b", "c", "d", "e", "f"]);
    const { warnings } = scheduleRoundRobinSlotsInWindow(pairings, {
      ...baseWindow,
      endDateYmd: "2026-07-01",
      dayEndHm: "09:00",
      fieldIds: ["f1"],
      minRestMinutes: 0,
      travelMinutesBetweenFields: 0,
    });
    assert.ok(warnings.length >= 1);
  });

  it("carries field occupancy across pools via cursor", () => {
    const p1 = buildRoundRobinPairings(["a", "b"]);
    const first = scheduleRoundRobinSlotsInWindow(p1, {
      ...baseWindow,
      fieldIds: ["f1"],
    });
    const p2 = buildRoundRobinPairings(["c", "d"]);
    const second = scheduleRoundRobinSlotsInWindow(p2, {
      ...baseWindow,
      fieldIds: ["f1"],
    }, first.cursor);
    assert.equal(first.slots.length, 1);
    assert.equal(second.slots.length, 1);
    assert.ok(second.slots[0]!.scheduledAt.getTime() > first.slots[0]!.scheduledAt.getTime());
  });
});

describe("estimateScheduleCapacity", () => {
  it("flags when constraints will not fit", () => {
    const est = estimateScheduleCapacity({
      poolTeamCounts: [6, 6],
      fieldCount: 1,
      timezone: "UTC",
      startDateYmd: "2026-07-01",
      endDateYmd: "2026-07-01",
      dayStartHm: "08:00",
      dayEndHm: "10:00",
      slotMinutes: 90,
      gameDurationMinutes: 75,
      minRestMinutes: 45,
      travelMinutesBetweenFields: 20,
    });
    assert.equal(est.fits, false);
    assert.ok(est.warnings.length >= 1);
  });
});

describe("emptySchedulePackingCursor", () => {
  it("starts empty", () => {
    const c = emptySchedulePackingCursor();
    assert.equal(c.nextWaveAt, null);
    assert.equal(c.fieldFreeAt.size, 0);
  });
});

describe("travelMinutesBetween", () => {
  it("uses uniform default when no matrix", () => {
    assert.equal(
      travelMinutesBetween("f1", "f2", {
        fieldIds: ["f1", "f2"],
        travelMinutesBetweenFields: 12,
      }),
      12,
    );
    assert.equal(
      travelMinutesBetween("f1", "f1", {
        fieldIds: ["f1", "f2"],
        travelMinutesBetweenFields: 12,
      }),
      0,
    );
  });

  it("reads pairwise matrix cells when provided", () => {
    const matrix = [
      [0, 5],
      [40, 0],
    ];
    assert.equal(
      travelMinutesBetween("f1", "f2", {
        fieldIds: ["f1", "f2"],
        travelMinutesBetweenFields: 99,
        fieldTravelMatrix: matrix,
      }),
      5,
    );
    assert.equal(
      travelMinutesBetween("f2", "f1", {
        fieldIds: ["f1", "f2"],
        travelMinutesBetweenFields: 99,
        fieldTravelMatrix: matrix,
      }),
      40,
    );
  });

  it("applies matrix travel when packing switches fields", () => {
    const pairings = buildRoundRobinPairings(["a", "b", "c", "d"]);
    const { slots: withMatrix } = scheduleRoundRobinSlotsInWindow(pairings, {
      ...baseWindow,
      fieldIds: ["f1", "f2"],
      travelMinutesBetweenFields: 0,
      fieldTravelMatrix: [
        [0, 90],
        [90, 0],
      ],
      gameDurationMinutes: 30,
      minRestMinutes: 0,
      slotMinutes: 30,
      endDateYmd: "2026-07-03",
    });
    const { slots: noTravel } = scheduleRoundRobinSlotsInWindow(pairings, {
      ...baseWindow,
      fieldIds: ["f1", "f2"],
      travelMinutesBetweenFields: 0,
      gameDurationMinutes: 30,
      minRestMinutes: 0,
      slotMinutes: 30,
      endDateYmd: "2026-07-03",
    });
    assert.equal(withMatrix.length, noTravel.length);
    const lastWith = withMatrix[withMatrix.length - 1]!.scheduledAt.getTime();
    const lastNo = noTravel[noTravel.length - 1]!.scheduledAt.getTime();
    assert.ok(lastWith >= lastNo);
  });
});
