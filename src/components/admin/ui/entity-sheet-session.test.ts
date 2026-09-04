import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createInitialEntitySheetState,
  entitySheetReducer,
  resolveEntityById,
} from "./entity-sheet-session";

describe("entitySheetReducer", () => {
  it("OPEN increments session and stores entityId", () => {
    const next = entitySheetReducer(createInitialEntitySheetState(), {
      type: "OPEN",
      mode: "edit",
      entityId: "abc",
    });
    assert.equal(next.mode, "edit");
    assert.equal(next.entityId, "abc");
    assert.equal(next.session, 1);
    assert.equal(next.open, true);
  });

  it("CLOSE keeps mode/session for exit animation", () => {
    let state = entitySheetReducer(createInitialEntitySheetState(), {
      type: "OPEN",
      mode: "add",
    });
    state = entitySheetReducer(state, { type: "CLOSE" });
    assert.equal(state.open, false);
    assert.equal(state.mode, "add");
    assert.equal(state.session, 1);
  });

  it("re-OPEN bumps session for remount", () => {
    let state = entitySheetReducer(createInitialEntitySheetState(), {
      type: "OPEN",
      mode: "add",
    });
    state = entitySheetReducer(state, { type: "CLOSE" });
    state = entitySheetReducer(state, { type: "OPEN", mode: "add" });
    assert.equal(state.session, 2);
    assert.equal(state.open, true);
  });

  it("ENTITY_GONE clears edit session", () => {
    let state = entitySheetReducer(createInitialEntitySheetState(), {
      type: "OPEN",
      mode: "edit",
      entityId: "x",
    });
    state = entitySheetReducer(state, { type: "ENTITY_GONE" });
    assert.equal(state.open, false);
    assert.equal(state.mode, "idle");
    assert.equal(state.entityId, null);
  });
});

describe("resolveEntityById", () => {
  const items = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
  ];

  it("finds by id", () => {
    assert.equal(resolveEntityById(items, "b")?.name, "B");
  });

  it("returns null for missing", () => {
    assert.equal(resolveEntityById(items, "z"), null);
    assert.equal(resolveEntityById(items, null), null);
  });
});
