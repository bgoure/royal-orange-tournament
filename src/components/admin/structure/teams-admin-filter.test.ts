/**
 * Unit tests for the pure TeamsAdmin filter reducer, sheet-session reducer,
 * and applyTeamsFilter helper.
 * No DOM, no React, no database — safe to run without any environment variables.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyTeamsFilter,
  INITIAL_FILTER_STATE,
  INITIAL_SHEET_STATE,
  resolveEditingTeam,
  teamsFilterReducer,
  teamsSheetReducer,
  type TeamWithRelations,
  type TeamsFilterState,
  type TeamsSheetState,
} from "./TeamsAdmin";

// ---------------------------------------------------------------------------
// Minimal fixture factories
// ---------------------------------------------------------------------------

function makeDiv(id: string, name: string) {
  return { id, name, sortOrder: 0, tournamentId: "t1" };
}

function makePool(id: string, divisionId: string, poolName: string) {
  const div = makeDiv(divisionId, `Div-${divisionId}`);
  return { id, divisionId, name: poolName, sortOrder: 0, division: div };
}

function makeTeam(
  id: string,
  name: string,
  poolId: string,
  divisionId: string,
  poolName: string,
  seed: number | null = null,
): TeamWithRelations {
  return {
    id,
    name,
    poolId,
    seed,
    logo: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    pool: makePool(poolId, divisionId, poolName) as TeamWithRelations["pool"],
  };
}

const TEAMS: TeamWithRelations[] = [
  makeTeam("t1", "Lightning",  "p1", "d1", "Pool A", 1),
  makeTeam("t2", "Thunder",    "p1", "d1", "Pool A", 2),
  makeTeam("t3", "Storm",      "p2", "d1", "Pool B", null),
  makeTeam("t4", "Eagles",     "p3", "d2", "Pool X", 1),
  makeTeam("t5", "Falcons",    "p3", "d2", "Pool X", 2),
];

// ---------------------------------------------------------------------------
// teamsFilterReducer
// ---------------------------------------------------------------------------

describe("teamsFilterReducer", () => {
  it("SET_SEARCH updates search and leaves other fields", () => {
    const next = teamsFilterReducer(INITIAL_FILTER_STATE, { type: "SET_SEARCH", value: "Light" });
    assert.equal(next.search, "Light");
    assert.equal(next.divisionId, "");
    assert.equal(next.poolId, "");
    assert.equal(next.sortBy, "name");
  });

  it("SET_DIVISION resets poolId to prevent stale cross-division pool", () => {
    const withPool: TeamsFilterState = { ...INITIAL_FILTER_STATE, divisionId: "d1", poolId: "p1" };
    const next = teamsFilterReducer(withPool, { type: "SET_DIVISION", value: "d2" });
    assert.equal(next.divisionId, "d2");
    assert.equal(next.poolId, "");
  });

  it("SET_POOL updates only poolId", () => {
    const withDiv: TeamsFilterState = { ...INITIAL_FILTER_STATE, divisionId: "d1" };
    const next = teamsFilterReducer(withDiv, { type: "SET_POOL", value: "p2" });
    assert.equal(next.poolId, "p2");
    assert.equal(next.divisionId, "d1");
  });

  it("SET_SORT updates sortBy", () => {
    const next = teamsFilterReducer(INITIAL_FILTER_STATE, { type: "SET_SORT", value: "seed" });
    assert.equal(next.sortBy, "seed");
  });

  it("RESET returns exactly INITIAL_FILTER_STATE", () => {
    const dirty: TeamsFilterState = { search: "x", divisionId: "d1", poolId: "p1", sortBy: "pool" };
    const next = teamsFilterReducer(dirty, { type: "RESET" });
    assert.deepEqual(next, INITIAL_FILTER_STATE);
  });

  it("unknown action returns state unchanged (type safety)", () => {
    // Cast to exercise the default branch without a TypeScript error.
    const next = teamsFilterReducer(INITIAL_FILTER_STATE, { type: "UNKNOWN" } as never);
    assert.deepEqual(next, INITIAL_FILTER_STATE);
  });
});

// ---------------------------------------------------------------------------
// applyTeamsFilter — search
// ---------------------------------------------------------------------------

describe("applyTeamsFilter — search", () => {
  it("returns all teams when search is empty", () => {
    const out = applyTeamsFilter(TEAMS, INITIAL_FILTER_STATE);
    assert.equal(out.length, TEAMS.length);
  });

  it("filters case-insensitively by name substring", () => {
    const filter: TeamsFilterState = { ...INITIAL_FILTER_STATE, search: "light" };
    const out = applyTeamsFilter(TEAMS, filter);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.id, "t1");
  });

  it("returns empty array when no name matches", () => {
    const filter: TeamsFilterState = { ...INITIAL_FILTER_STATE, search: "zzz" };
    const out = applyTeamsFilter(TEAMS, filter);
    assert.equal(out.length, 0);
  });

  it("ignores leading/trailing whitespace in the search term", () => {
    const filter: TeamsFilterState = { ...INITIAL_FILTER_STATE, search: "  Thunder  " };
    const out = applyTeamsFilter(TEAMS, filter);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.id, "t2");
  });
});

// ---------------------------------------------------------------------------
// applyTeamsFilter — division / pool filters
// ---------------------------------------------------------------------------

describe("applyTeamsFilter — division filter", () => {
  it("returns only teams from the selected division", () => {
    const filter: TeamsFilterState = { ...INITIAL_FILTER_STATE, divisionId: "d1" };
    const out = applyTeamsFilter(TEAMS, filter);
    assert.equal(out.length, 3);
    assert.ok(out.every((t) => t.pool.division.id === "d1"));
  });

  it("returns only teams from another division", () => {
    const filter: TeamsFilterState = { ...INITIAL_FILTER_STATE, divisionId: "d2" };
    const out = applyTeamsFilter(TEAMS, filter);
    assert.equal(out.length, 2);
    assert.ok(out.every((t) => t.pool.division.id === "d2"));
  });
});

describe("applyTeamsFilter — pool filter", () => {
  it("filters to a single pool", () => {
    const filter: TeamsFilterState = { ...INITIAL_FILTER_STATE, poolId: "p2" };
    const out = applyTeamsFilter(TEAMS, filter);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.id, "t3");
  });

  it("combining division + pool returns the correct subset", () => {
    const filter: TeamsFilterState = { ...INITIAL_FILTER_STATE, divisionId: "d1", poolId: "p1" };
    const out = applyTeamsFilter(TEAMS, filter);
    assert.equal(out.length, 2);
    assert.ok(out.every((t) => t.poolId === "p1"));
  });
});

// ---------------------------------------------------------------------------
// applyTeamsFilter — sort orders
// ---------------------------------------------------------------------------

describe("applyTeamsFilter — sort by name", () => {
  it("sorts alphabetically when sortBy is 'name'", () => {
    const filter: TeamsFilterState = { ...INITIAL_FILTER_STATE, sortBy: "name" };
    const out = applyTeamsFilter(TEAMS, filter);
    const names = out.map((t) => t.name);
    assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
  });
});

describe("applyTeamsFilter — sort by seed", () => {
  it("puts seeded teams before unseeded (null → Infinity)", () => {
    const filter: TeamsFilterState = { ...INITIAL_FILTER_STATE, divisionId: "d1", sortBy: "seed" };
    const out = applyTeamsFilter(TEAMS, filter);
    // t1 (seed 1), t2 (seed 2), t3 (seed null)
    assert.equal(out[0]!.id, "t1");
    assert.equal(out[1]!.id, "t2");
    assert.equal(out[2]!.id, "t3");
  });

  it("breaks seed ties alphabetically", () => {
    const alpha = makeTeam("a1", "Aces",  "p3", "d2", "Pool X", 1);
    const beta  = makeTeam("a2", "Bears", "p3", "d2", "Pool X", 1);
    const filter: TeamsFilterState = { ...INITIAL_FILTER_STATE, sortBy: "seed" };
    const out = applyTeamsFilter([beta, alpha], filter);
    assert.equal(out[0]!.id, "a1"); // "Aces" < "Bears"
  });
});

describe("applyTeamsFilter — sort by pool", () => {
  it("groups by division name then pool name then team name", () => {
    const filter: TeamsFilterState = { ...INITIAL_FILTER_STATE, sortBy: "pool" };
    const out = applyTeamsFilter(TEAMS, filter);
    for (let i = 1; i < out.length; i++) {
      const prev = out[i - 1]!;
      const curr = out[i]!;
      const divCmp = prev.pool.division.name.localeCompare(curr.pool.division.name);
      const poolCmp = prev.pool.name.localeCompare(curr.pool.name);
      const nameCmp = prev.name.localeCompare(curr.name);
      // The comparison key must be ≤ 0 (never jump backwards).
      const key = divCmp !== 0 ? divCmp : poolCmp !== 0 ? poolCmp : nameCmp;
      assert.ok(key <= 0, `Sort violation between ${prev.name} and ${curr.name}: key=${key}`);
    }
  });
});

// ---------------------------------------------------------------------------
// applyTeamsFilter — does not mutate original array
// ---------------------------------------------------------------------------

describe("applyTeamsFilter — immutability", () => {
  it("does not mutate the input array", () => {
    const copy = [...TEAMS];
    applyTeamsFilter(TEAMS, { ...INITIAL_FILTER_STATE, sortBy: "seed" });
    assert.deepEqual(TEAMS, copy);
  });
});

// ---------------------------------------------------------------------------
// teamsSheetReducer — session keys and teamId storage
// ---------------------------------------------------------------------------

describe("teamsSheetReducer", () => {
  it("OPEN_ADD increments session and opens add mode", () => {
    const next = teamsSheetReducer(INITIAL_SHEET_STATE, { type: "OPEN_ADD" });
    assert.equal(next.mode, "add");
    assert.equal(next.session, 1);
    assert.equal(next.teamId, null);
    assert.equal(next.open, true);
  });

  it("OPEN_EDIT stores teamId and increments session", () => {
    const next = teamsSheetReducer(INITIAL_SHEET_STATE, {
      type: "OPEN_EDIT",
      teamId: "t1",
    });
    assert.equal(next.mode, "edit");
    assert.equal(next.teamId, "t1");
    assert.equal(next.session, 1);
    assert.equal(next.open, true);
  });

  it("re-opening increments session so React remounts clean action state", () => {
    let state = teamsSheetReducer(INITIAL_SHEET_STATE, { type: "OPEN_ADD" });
    state = teamsSheetReducer(state, { type: "CLOSE" });
    assert.equal(state.open, false);
    assert.equal(state.mode, "add"); // mode kept for exit animation
    assert.equal(state.session, 1);

    state = teamsSheetReducer(state, { type: "OPEN_ADD" });
    assert.equal(state.session, 2);
    assert.equal(state.open, true);
    assert.equal(state.mode, "add");
  });

  it("OPEN_IMPORT increments session", () => {
    const afterAdd = teamsSheetReducer(INITIAL_SHEET_STATE, { type: "OPEN_ADD" });
    const next = teamsSheetReducer(afterAdd, { type: "OPEN_IMPORT" });
    assert.equal(next.mode, "import");
    assert.equal(next.session, 2);
    assert.equal(next.teamId, null);
  });

  it("CLOSE sets open=false without resetting session or mode", () => {
    const open: TeamsSheetState = {
      mode: "edit",
      session: 3,
      teamId: "t2",
      open: true,
    };
    const next = teamsSheetReducer(open, { type: "CLOSE" });
    assert.deepEqual(next, { mode: "edit", session: 3, teamId: "t2", open: false });
  });

  it("TEAM_GONE closes an edit session and clears teamId", () => {
    const open: TeamsSheetState = {
      mode: "edit",
      session: 4,
      teamId: "gone",
      open: true,
    };
    const next = teamsSheetReducer(open, { type: "TEAM_GONE" });
    assert.equal(next.open, false);
    assert.equal(next.mode, "idle");
    assert.equal(next.teamId, null);
    assert.equal(next.session, 4); // session unchanged
  });

  it("TEAM_GONE is a no-op for non-edit modes", () => {
    const open = teamsSheetReducer(INITIAL_SHEET_STATE, { type: "OPEN_ADD" });
    const next = teamsSheetReducer(open, { type: "TEAM_GONE" });
    assert.deepEqual(next, open);
  });

  it("switching from edit to add clears teamId and bumps session", () => {
    let state = teamsSheetReducer(INITIAL_SHEET_STATE, {
      type: "OPEN_EDIT",
      teamId: "t1",
    });
    state = teamsSheetReducer(state, { type: "OPEN_ADD" });
    assert.equal(state.mode, "add");
    assert.equal(state.teamId, null);
    assert.equal(state.session, 2);
  });
});

describe("resolveEditingTeam", () => {
  it("returns the matching team from the latest list", () => {
    const found = resolveEditingTeam(TEAMS, "t3");
    assert.equal(found?.id, "t3");
    assert.equal(found?.name, "Storm");
  });

  it("returns null when teamId is null", () => {
    assert.equal(resolveEditingTeam(TEAMS, null), null);
  });

  it("returns null when the team is no longer in the list", () => {
    assert.equal(resolveEditingTeam(TEAMS, "missing"), null);
  });

  it("picks up updated logo data from a refreshed list", () => {
    const withLogo: TeamWithRelations = {
      ...TEAMS[0]!,
      logo: { mimeType: "image/png", updatedAt: new Date("2026-06-01") },
    };
    const refreshed = [withLogo, ...TEAMS.slice(1)];
    const found = resolveEditingTeam(refreshed, "t1");
    assert.ok(found?.logo);
    assert.equal(found!.logo!.mimeType, "image/png");
  });
});
