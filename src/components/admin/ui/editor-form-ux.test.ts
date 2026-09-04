import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  discardEditsConfirmDescription,
  discardEditsConfirmTitle,
  editorUnsavedLabel,
  shouldBlockSheetClose,
} from "./editor-form-ux";

describe("editor-form-ux", () => {
  it("blocks close only while dirty and not flashing success", () => {
    assert.equal(shouldBlockSheetClose(true, false), true);
    assert.equal(shouldBlockSheetClose(true, true), false);
    assert.equal(shouldBlockSheetClose(false, false), false);
  });

  it("exposes stable discard copy", () => {
    assert.match(discardEditsConfirmTitle(), /Discard/i);
    assert.match(discardEditsConfirmDescription(), /lost/i);
    assert.match(editorUnsavedLabel(), /Unsaved/i);
  });
});
