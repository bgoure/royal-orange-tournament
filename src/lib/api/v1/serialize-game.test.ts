import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mapGameToApiListItem,
  parseOptionalGameStatus,
  parseSchedulePagination,
} from "./serialize-game";

describe("parseSchedulePagination", () => {
  it("defaults and clamps", () => {
    assert.deepEqual(parseSchedulePagination(new URLSearchParams()), { page: 1, limit: 50 });
    assert.deepEqual(parseSchedulePagination(new URLSearchParams("page=2&limit=20")), {
      page: 2,
      limit: 20,
    });
    assert.equal(parseSchedulePagination(new URLSearchParams("limit=999")).limit, 200);
    assert.equal(parseSchedulePagination(new URLSearchParams("page=0")).page, 1);
  });
});

describe("parseOptionalGameStatus", () => {
  it("accepts known statuses", () => {
    assert.equal(parseOptionalGameStatus("LIVE"), "LIVE");
    assert.equal(parseOptionalGameStatus("final"), "FINAL");
    assert.equal(parseOptionalGameStatus("nope"), undefined);
  });
});

describe("mapGameToApiListItem", () => {
  const base = {
    id: "g1",
    gameNumber: "1",
    scheduledAt: new Date("2026-07-10T14:00:00.000Z"),
    updatedAt: new Date("2026-07-10T15:00:00.000Z"),
    status: "SCHEDULED" as const,
    homeRuns: null as number | null,
    awayRuns: null as number | null,
    field: { id: "f1", name: "F1", location: { name: "Park" } },
    homeTeam: { id: "t1", name: "Home" },
    awayTeam: { id: "t2", name: "Away" },
    pool: { id: "p1", name: "A", division: { id: "d1", name: "10U" } },
    division: null,
  };

  it("hides scores for scheduled games", () => {
    const m = mapGameToApiListItem({ ...base, homeRuns: 3, awayRuns: 1 });
    assert.equal(m.homeRuns, null);
    assert.equal(m.awayRuns, null);
    assert.ok(m.updatedAt.endsWith("Z"));
  });

  it("shows scores for FINAL and LIVE with runs", () => {
    assert.equal(mapGameToApiListItem({ ...base, status: "FINAL", homeRuns: 3, awayRuns: 1 }).homeRuns, 3);
    assert.equal(mapGameToApiListItem({ ...base, status: "LIVE", homeRuns: 2, awayRuns: 0 }).awayRuns, 0);
  });
});
