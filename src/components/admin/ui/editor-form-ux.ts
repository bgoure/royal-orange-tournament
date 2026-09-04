/**
 * Pure helpers for editor-sheet UX (dirty / discard copy).
 */

export function editorUnsavedLabel(): string {
  return "Unsaved changes";
}

export function discardEditsConfirmTitle(): string {
  return "Discard unsaved changes?";
}

export function discardEditsConfirmDescription(): string {
  return "Your edits will be lost if you leave without saving.";
}

/** Close should be blocked when the form is dirty and we are not in a success flash. */
export function shouldBlockSheetClose(dirty: boolean, successFlash: boolean): boolean {
  return dirty && !successFlash;
}
