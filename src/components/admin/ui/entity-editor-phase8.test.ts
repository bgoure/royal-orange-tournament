import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  createInitialEntitySheetState,
  entitySheetReducer,
} from "@/components/admin/ui/entity-sheet-session";
import {
  discardEditsConfirmTitle,
  shouldBlockSheetClose,
} from "@/components/admin/ui/editor-form-ux";

const sheetSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "EntityEditorSheet.tsx"),
  "utf8",
);

describe("entity editor session + unsaved close", () => {
  it("opens add and edit modes with a new session key", () => {
    let state = createInitialEntitySheetState();
    state = entitySheetReducer(state, { type: "OPEN", mode: "add" });
    assert.equal(state.open, true);
    assert.equal(state.mode, "add");
    const addSession = state.session;

    state = entitySheetReducer(state, { type: "OPEN", mode: "edit", entityId: "team-1" });
    assert.equal(state.mode, "edit");
    assert.equal(state.entityId, "team-1");
    assert.notEqual(state.session, addSession);
  });

  it("blocks close while dirty unless a success flash is active", () => {
    assert.equal(shouldBlockSheetClose(true, false), true);
    assert.equal(shouldBlockSheetClose(true, true), false);
    assert.match(discardEditsConfirmTitle(), /Discard/i);
  });

  it("closes the sheet session after a successful flow (CLOSE)", () => {
    let state = createInitialEntitySheetState();
    state = entitySheetReducer(state, { type: "OPEN", mode: "edit", entityId: "x" });
    state = entitySheetReducer(state, { type: "CLOSE" });
    assert.equal(state.open, false);
  });
});

describe("EntityEditorSheet mobile layout", () => {
  it("uses full-viewport height on the phone bottom sheet", () => {
    assert.match(sheetSource, /h-\[100dvh\]/);
    assert.match(sheetSource, /max-h-\[100dvh\]/);
    assert.match(sheetSource, /overflow-x-hidden/);
  });

  it("keeps sticky header and footer structure", () => {
    assert.match(sheetSource, /Sticky header/);
    assert.match(sheetSource, /Sticky footer/);
    assert.match(sheetSource, /dangerZone/);
  });
});
