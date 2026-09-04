import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { saveBracketRoundZeroSeedingSchema } from "@/lib/validations/bracket-seed-board";
import {
  bankTeams,
  byeSeedsReady,
  clearSideSnapshot,
  collectPlacedTeamIds,
  createBaseline,
  createInitialSeedBoardState,
  isBoardDirty,
  placeOnByeSeedSnapshot,
  placeOnSnapshot,
  seedBoardReducer,
  toSavePayload,
  type SeedBoardMatch,
  type SeedBoardTeam,
} from "./bracket-seed-board-state";

const teams: SeedBoardTeam[] = [
  { id: "t1", name: "Alpha" },
  { id: "t2", name: "Beta" },
  { id: "t3", name: "Gamma" },
  { id: "t4", name: "Delta" },
];

const names = new Map(teams.map((t) => [t.id, t.name]));

function emptyMatches(): SeedBoardMatch[] {
  return [
    {
      matchId: "m0",
      matchIndex: 0,
      home: { kind: "empty" },
      away: { kind: "empty" },
      locked: false,
    },
    {
      matchId: "m1",
      matchIndex: 1,
      home: { kind: "empty" },
      away: { kind: "empty" },
      locked: false,
    },
  ];
}

describe("bracket-seed-board-state", () => {
  it("moves a bank team into an empty slot", () => {
    const snap = createBaseline(emptyMatches(), []);
    const next = placeOnSnapshot(snap, "m0", "away", { type: "team", teamId: "t1" }, names);
    assert.ok(next);
    assert.equal(next!.matches[0]!.away.kind, "team");
    if (next!.matches[0]!.away.kind === "team") {
      assert.equal(next!.matches[0]!.away.teamId, "t1");
    }
    assert.deepEqual(
      bankTeams(teams, next!).map((t) => t.id).sort(),
      ["t2", "t3", "t4"],
    );
  });

  it("swaps two occupied slots", () => {
    let snap = createBaseline(emptyMatches(), []);
    snap = placeOnSnapshot(snap, "m0", "away", { type: "team", teamId: "t1" }, names)!;
    snap = placeOnSnapshot(snap, "m1", "home", { type: "team", teamId: "t2" }, names)!;
    const swapped = placeOnSnapshot(
      snap,
      "m1",
      "home",
      { type: "team", teamId: "t1", from: { matchId: "m0", side: "away" } },
      names,
    )!;
    assert.equal(
      swapped.matches[0]!.away.kind === "team" ? swapped.matches[0]!.away.teamId : null,
      "t2",
    );
    assert.equal(
      swapped.matches[1]!.home.kind === "team" ? swapped.matches[1]!.home.teamId : null,
      "t1",
    );
  });

  it("places a team on a bye seed seat and clears Round 1 duplicates", () => {
    let snap = createBaseline(emptyMatches(), [null, null]);
    snap = placeOnSnapshot(snap, "m0", "home", { type: "team", teamId: "t3" }, names)!;
    const next = placeOnByeSeedSnapshot(snap, 0, { type: "team", teamId: "t3" }, names)!;
    assert.equal(next.byeSeedIds[0], "t3");
    assert.equal(next.matches[0]!.home.kind, "empty");
    assert.equal(collectPlacedTeamIds(next).has("t3"), true);
  });

  it("removes a team from a slot", () => {
    let snap = createBaseline(emptyMatches(), []);
    snap = placeOnSnapshot(snap, "m0", "away", { type: "team", teamId: "t1" }, names)!;
    const cleared = clearSideSnapshot(snap, "m0", "away")!;
    assert.equal(cleared.matches[0]!.away.kind, "empty");
    assert.equal(collectPlacedTeamIds(cleared).has("t1"), false);
  });

  it("prevents duplicate team placements from the bank", () => {
    let snap = createBaseline(emptyMatches(), []);
    snap = placeOnSnapshot(snap, "m0", "away", { type: "team", teamId: "t1" }, names)!;
    snap = placeOnSnapshot(snap, "m1", "home", { type: "team", teamId: "t1" }, names)!;
    assert.equal(snap.matches[0]!.away.kind, "empty");
    assert.equal(
      snap.matches[1]!.home.kind === "team" ? snap.matches[1]!.home.teamId : null,
      "t1",
    );
  });

  it("refuses changes to a locked slot", () => {
    const matches = emptyMatches();
    matches[0] = { ...matches[0]!, locked: true };
    const snap = createBaseline(matches, []);
    assert.equal(
      placeOnSnapshot(snap, "m0", "away", { type: "team", teamId: "t1" }, names),
      null,
    );
    assert.equal(clearSideSnapshot(snap, "m0", "away"), null);
  });

  it("does not model derived later-round feeder seats as placeable state", () => {
    // Board state only holds Round 1 matches + optional bye-seed ids.
    const snap = createBaseline(emptyMatches(), [null]);
    assert.equal(snap.matches.every((m) => m.matchIndex < 2), true);
    assert.equal("laterRound" in snap, false);
  });

  it("reset restores the baseline snapshot", () => {
    const baseline = createBaseline(emptyMatches(), [null]);
    let state = createInitialSeedBoardState(baseline);
    state = seedBoardReducer(state, {
      type: "PLACE_ON",
      matchId: "m0",
      side: "away",
      payload: { type: "team", teamId: "t1" },
      teamNameById: names,
      editable: true,
    });
    assert.equal(isBoardDirty(state, baseline), true);
    state = seedBoardReducer(state, { type: "RESET", baseline });
    assert.equal(isBoardDirty(state, baseline), false);
    assert.equal(state.undoStack.length, 0);
    assert.equal(state.matches[0]!.away.kind, "empty");
  });

  it("undo restores the prior snapshot", () => {
    const baseline = createBaseline(emptyMatches(), []);
    let state = createInitialSeedBoardState(baseline);
    state = seedBoardReducer(state, {
      type: "PLACE_ON",
      matchId: "m0",
      side: "home",
      payload: { type: "team", teamId: "t2" },
      teamNameById: names,
      editable: true,
    });
    state = seedBoardReducer(state, { type: "UNDO" });
    assert.equal(state.matches[0]!.home.kind, "empty");
  });

  it("serialized payload matches the pending board and Zod schema", () => {
    let snap = createBaseline(emptyMatches(), [null]);
    snap = placeOnSnapshot(snap, "m0", "away", { type: "team", teamId: "t1" }, names)!;
    snap = placeOnSnapshot(snap, "m0", "home", { type: "bye" }, names)!;
    snap = placeOnSnapshot(snap, "m1", "away", { type: "team", teamId: "t2" }, names)!;
    snap = placeOnSnapshot(snap, "m1", "home", { type: "team", teamId: "t3" }, names)!;
    snap = placeOnByeSeedSnapshot(snap, 0, { type: "team", teamId: "t4" }, names)!;
    const payload = toSavePayload(snap);
    assert.deepEqual(payload.slots[0], {
      matchId: "m0",
      away: { teamId: "t1" },
      home: { bye: true },
    });
    assert.deepEqual(payload.slots[1], {
      matchId: "m1",
      away: { teamId: "t2" },
      home: { teamId: "t3" },
    });
    assert.deepEqual(payload.byeSeedTeamIds, ["t4"]);
    assert.equal(byeSeedsReady(1, snap.byeSeedIds), true);

    const parsed = saveBracketRoundZeroSeedingSchema.safeParse({
      bracketId: "b1",
      slots: payload.slots,
      byeSeedTeamIds: payload.byeSeedTeamIds,
    });
    assert.equal(parsed.success, true);
  });

  it("ignores place actions when not editable", () => {
    const baseline = createBaseline(emptyMatches(), []);
    let state = createInitialSeedBoardState(baseline);
    state = seedBoardReducer(state, {
      type: "PLACE_ON",
      matchId: "m0",
      side: "away",
      payload: { type: "team", teamId: "t1" },
      teamNameById: names,
      editable: false,
    });
    assert.equal(state.matches[0]!.away.kind, "empty");
  });

  it("clears impact acknowledgment after payload-changing edits, undo, and reset", () => {
    const baseline = createBaseline(emptyMatches(), [null]);
    let state = createInitialSeedBoardState(baseline);
    state = seedBoardReducer(state, {
      type: "PLACE_ON",
      matchId: "m0",
      side: "away",
      payload: { type: "team", teamId: "t1" },
      teamNameById: names,
      editable: true,
    });
    state = seedBoardReducer(state, { type: "SET_ACK", value: true });
    assert.equal(state.ackImpact, true);

    state = seedBoardReducer(state, { type: "TOGGLE_TEAM", teamId: "t2", editable: true });
    assert.equal(state.ackImpact, true, "selection-only actions must keep acknowledgment");

    state = seedBoardReducer(state, {
      type: "PLACE_ON",
      matchId: "m0",
      side: "home",
      payload: { type: "team", teamId: "t2" },
      teamNameById: names,
      editable: true,
    });
    assert.equal(state.ackImpact, false, "a later seed edit must clear acknowledgment");

    state = seedBoardReducer(state, { type: "SET_ACK", value: true });
    state = seedBoardReducer(state, {
      type: "PLACE_BYE_SEED",
      index: 0,
      payload: { type: "team", teamId: "t3" },
      teamNameById: names,
      editable: true,
    });
    assert.equal(state.ackImpact, false);

    state = seedBoardReducer(state, { type: "SET_ACK", value: true });
    state = seedBoardReducer(state, { type: "UNDO" });
    assert.equal(state.ackImpact, false, "undo of a different snapshot must clear acknowledgment");

    state = seedBoardReducer(state, { type: "SET_ACK", value: true });
    state = seedBoardReducer(state, { type: "RESET", baseline });
    assert.equal(state.ackImpact, false, "reset must clear acknowledgment");
  });
});
