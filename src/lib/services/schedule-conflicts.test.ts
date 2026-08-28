import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_FIELD_OCCUPANCY_MINUTES,
  findOverlappingFieldPairs,
  intervalsOverlap,
} from "./schedule-conflicts";

describe("intervalsOverlap", () => {
  it("detects partial overlap", () => {
    const a0 = new Date("2026-07-01T10:00:00Z");
    const a1 = new Date("2026-07-01T11:30:00Z");
    const b0 = new Date("2026-07-01T11:00:00Z");
    const b1 = new Date("2026-07-01T12:30:00Z");
    assert.equal(intervalsOverlap(a0, a1, b0, b1), true);
  });

  it("allows back-to-back (end == start)", () => {
    const a0 = new Date("2026-07-01T10:00:00Z");
    const a1 = new Date("2026-07-01T11:30:00Z");
    const b0 = new Date("2026-07-01T11:30:00Z");
    const b1 = new Date("2026-07-01T13:00:00Z");
    assert.equal(intervalsOverlap(a0, a1, b0, b1), false);
  });
});

describe("findOverlappingFieldPairs", () => {
  it("flags two games on the same field within occupancy window", () => {
    const pairs = findOverlappingFieldPairs(
      [
        { id: "1", fieldId: "f1", scheduledAt: new Date("2026-07-01T10:00:00Z") },
        { id: "2", fieldId: "f1", scheduledAt: new Date("2026-07-01T10:30:00Z") },
        { id: "3", fieldId: "f2", scheduledAt: new Date("2026-07-01T10:00:00Z") },
      ],
      DEFAULT_FIELD_OCCUPANCY_MINUTES,
    );
    assert.equal(pairs.length, 1);
    assert.equal(pairs[0]!.a.id, "1");
    assert.equal(pairs[0]!.b.id, "2");
  });

  it("ignores CANCELLED games", () => {
    const pairs = findOverlappingFieldPairs([
      { id: "1", fieldId: "f1", scheduledAt: new Date("2026-07-01T10:00:00Z"), status: "CANCELLED" },
      { id: "2", fieldId: "f1", scheduledAt: new Date("2026-07-01T10:15:00Z"), status: "SCHEDULED" },
    ]);
    assert.equal(pairs.length, 0);
  });

  it("allows same field when starts are a full slot apart", () => {
    const pairs = findOverlappingFieldPairs([
      { id: "1", fieldId: "f1", scheduledAt: new Date("2026-07-01T10:00:00Z") },
      { id: "2", fieldId: "f1", scheduledAt: new Date("2026-07-01T11:30:00Z") },
    ]);
    assert.equal(pairs.length, 0);
  });

  it("allows 13-team A/B endgame games in the same bracket to share a slot", () => {
    const t = new Date("2026-09-06T12:00:00Z");
    const pairs = findOverlappingFieldPairs([
      { id: "a", fieldId: "f1", scheduledAt: t, gameNumber: "23A", bracketId: "br1" },
      { id: "b", fieldId: "f1", scheduledAt: t, gameNumber: "23B", bracketId: "br1" },
    ]);
    assert.equal(pairs.length, 0);
  });

  it("still flags A/B games from different brackets", () => {
    const t = new Date("2026-09-06T12:00:00Z");
    const pairs = findOverlappingFieldPairs([
      { id: "a", fieldId: "f1", scheduledAt: t, gameNumber: "23A", bracketId: "br1" },
      { id: "b", fieldId: "f1", scheduledAt: t, gameNumber: "23B", bracketId: "br2" },
    ]);
    assert.equal(pairs.length, 1);
  });
});
