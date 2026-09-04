/**
 * Regression: nested ConfirmDialog must remain interactive inside a Radix-style
 * modal content tree (pointer-events isolation). Sibling portals outside the
 * content node appear on top visually but cannot receive clicks/focus.
 *
 * Runs under jsdom via tsx — no browser driver required.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createElement, useEffect, useRef, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { JSDOM } from "jsdom";
import { ConfirmDialog } from "./ConfirmDialog";

// ---------------------------------------------------------------------------
// jsdom bootstrap (once per process)
// ---------------------------------------------------------------------------

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});

Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true });
Object.defineProperty(globalThis, "document", { value: dom.window.document, configurable: true });
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
Object.defineProperty(globalThis, "HTMLElement", { value: dom.window.HTMLElement, configurable: true });
Object.defineProperty(globalThis, "HTMLButtonElement", {
  value: dom.window.HTMLButtonElement,
  configurable: true,
});
Object.defineProperty(globalThis, "getComputedStyle", {
  value: dom.window.getComputedStyle.bind(dom.window),
  configurable: true,
});
Object.defineProperty(globalThis, "KeyboardEvent", {
  value: dom.window.KeyboardEvent,
  configurable: true,
});
Object.defineProperty(globalThis, "Event", {
  value: dom.window.Event,
  configurable: true,
});
// React 19 / testing helpers sometimes touch these:
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(Date.now()), 0) as unknown as number;
}
if (!globalThis.cancelAnimationFrame) {
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

// ---------------------------------------------------------------------------
// Modal shell that mirrors Radix modal pointer-events isolation
// ---------------------------------------------------------------------------

function RadixStyleModalShell({
  children,
  overlay,
  siblingOverlay,
}: {
  children?: ReactNode;
  /** Nested overlay — DOM descendant of the modal content (correct). */
  overlay?: ReactNode;
  /** Sibling outside content — looks above but blocked by pointer-events (bug). */
  siblingOverlay?: ReactNode;
}) {
  // Match Radix: body gets pointer-events:none; content gets pointer-events:auto.
  // Descendants of content inherit interactivity; siblings of content do not.
  document.body.style.pointerEvents = "none";

  return createElement(
    "div",
    { "data-testid": "page" },
    createElement(
      "div",
      {
        "data-testid": "modal-content",
        // fixed/relative containing block for absolute contained confirms
        style: {
          position: "fixed",
          inset: "0 0 0 auto",
          width: "24rem",
          pointerEvents: "auto",
          background: "white",
        },
      },
      children,
      overlay,
    ),
    siblingOverlay,
  );
}

function NestedDeleteFixture({
  placeConfirm,
  onConfirm,
}: {
  placeConfirm: "inside" | "sibling";
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const confirm = createElement(ConfirmDialog, {
    contained: placeConfirm === "inside",
    open,
    title: 'Delete "Lightning"?',
    description: "This is permanent.",
    confirmLabel: "Delete team",
    cancelLabel: "Cancel",
    tone: "danger",
    busy: false,
    onConfirm,
    onCancel: () => setOpen(false),
  });

  const deleteBtn = createElement(
    "button",
    {
      type: "button",
      "data-testid": "delete-trigger",
      onClick: () => setOpen(true),
    },
    "Delete team",
  );

  return createElement(
    RadixStyleModalShell,
    {
      overlay: placeConfirm === "inside" ? confirm : undefined,
      siblingOverlay: placeConfirm === "sibling" ? confirm : undefined,
    },
    deleteBtn,
  );
}

/**
 * Models EntityEditorSheet + nested ConfirmDialog Escape contract:
 * - Parent/Radix Escape listener is on document capture and is registered when
 *   the editor opens — before ConfirmDialog mounts its own capture handler.
 * - While confirmation is open, dismissible is false (same as TeamsAdmin), so the
 *   parent listener may observe Escape but must not unmount the editor.
 */
function NestedDeleteWithDismissibleEditor({
  onConfirm,
  onParentCaptureEscape,
  onBubbleEscape,
}: {
  onConfirm: () => void;
  /** May fire — Radix/Vaul capture runs before ConfirmDialog; that is OK. */
  onParentCaptureEscape?: () => void;
  /** Secondary: should not fire if ConfirmDialog stopPropagation works. */
  onBubbleEscape?: () => void;
}) {
  const [editorOpen, setEditorOpen] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Live dismissible flag read by the stable capture listener (ref so the parent
  // listener stays registered from editor-open, matching Vaul registration order).
  const dismissibleRef = useRef(true);
  useEffect(() => {
    dismissibleRef.current = !confirmOpen;
  }, [confirmOpen]);

  // Primary: parent/Radix capture listener — registered once while editor is open,
  // before ConfirmDialog's capture handler is added on confirm open.
  useEffect(() => {
    if (!editorOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onParentCaptureEscape?.();
      // EntityEditorSheet handleOpenChange(false): refuse close when !dismissible.
      if (!dismissibleRef.current) return;
      setEditorOpen(false);
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [editorOpen, onParentCaptureEscape]);

  // Secondary: bubble-phase observer (ConfirmDialog stopPropagation should block).
  useEffect(() => {
    if (!editorOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onBubbleEscape?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [editorOpen, onBubbleEscape]);

  if (!editorOpen) {
    return createElement("div", { "data-testid": "editor-closed" }, "closed");
  }

  return createElement(
    RadixStyleModalShell,
    {
      overlay: createElement(ConfirmDialog, {
        contained: true,
        open: confirmOpen,
        title: 'Delete "Lightning"?',
        description: "This is permanent.",
        confirmLabel: "Delete team",
        cancelLabel: "Cancel",
        tone: "danger",
        busy: false,
        onConfirm,
        onCancel: () => setConfirmOpen(false),
      }),
    },
    createElement(
      "button",
      {
        type: "button",
        "data-testid": "delete-trigger",
        onClick: () => setConfirmOpen(true),
      },
      "Delete team",
    ),
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function mount(node: ReactNode) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(node);
  });
}

function unmount() {
  act(() => {
    root?.unmount();
  });
  root = null;
  host?.remove();
  host = null;
  document.body.style.pointerEvents = "";
  document.body.innerHTML = "";
}

function isUnderModalContent(el: Element | null): boolean {
  return Boolean(el?.closest('[data-testid="modal-content"]'));
}

/** Approximate “can the user interact?” under Radix-style pointer-events rules. */
function isPointerReachable(el: HTMLElement): boolean {
  if (!isUnderModalContent(el)) return false;
  let node: HTMLElement | null = el;
  while (node) {
    const pe = node.style.pointerEvents || "";
    if (pe === "none") return false;
    if (node.getAttribute("data-testid") === "modal-content") return true;
    node = node.parentElement;
  }
  return false;
}

afterEach(() => {
  unmount();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("nested ConfirmDialog under Radix-style modal isolation", () => {
  it("contained confirm inside modal content can receive focus and dispatch delete", () => {
    let confirmed = 0;
    mount(
      createElement(NestedDeleteFixture, {
        placeConfirm: "inside",
        onConfirm: () => {
          confirmed += 1;
        },
      }),
    );

    const trigger = document.querySelector<HTMLButtonElement>('[data-testid="delete-trigger"]');
    assert.ok(trigger);
    act(() => {
      trigger.focus();
      trigger.click();
    });

    const confirmBtn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent === "Delete team" && b !== trigger,
    ) as HTMLButtonElement | undefined;
    assert.ok(confirmBtn, "expected confirm button to render");
    assert.equal(confirmBtn.getAttribute("disabled"), null);
    assert.ok(
      isPointerReachable(confirmBtn),
      "confirm button must be a descendant of modal-content to receive pointer events",
    );

    act(() => {
      confirmBtn.focus();
    });
    assert.equal(document.activeElement, confirmBtn, "confirm button must be focusable");

    act(() => {
      confirmBtn.click();
    });
    assert.equal(confirmed, 1, "confirm must dispatch the delete action once");
  });

  it("cancel restores focus to the Delete team trigger", () => {
    mount(
      createElement(NestedDeleteFixture, {
        placeConfirm: "inside",
        onConfirm: () => {},
      }),
    );

    const trigger = document.querySelector<HTMLButtonElement>('[data-testid="delete-trigger"]')!;
    act(() => {
      trigger.focus();
      trigger.click();
    });

    const cancelBtn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent === "Cancel",
    ) as HTMLButtonElement | undefined;
    assert.ok(cancelBtn);

    act(() => {
      cancelBtn.click();
    });

    assert.equal(
      document.activeElement,
      trigger,
      "Cancel should restore focus to the Delete team trigger",
    );
  });

  it("Escape closes contained confirm without dismissing the editor or deleting", () => {
    let confirmed = 0;
    let parentCaptureEscapes = 0;
    let bubbleEscapes = 0;
    mount(
      createElement(NestedDeleteWithDismissibleEditor, {
        onConfirm: () => {
          confirmed += 1;
        },
        onParentCaptureEscape: () => {
          parentCaptureEscapes += 1;
        },
        onBubbleEscape: () => {
          bubbleEscapes += 1;
        },
      }),
    );

    const trigger = document.querySelector<HTMLButtonElement>('[data-testid="delete-trigger"]')!;
    assert.ok(
      document.querySelector('[data-testid="modal-content"]'),
      "editor/modal shell should be mounted",
    );

    // Parent capture listener is already registered (editor open). Opening the
    // confirm adds ConfirmDialog's capture handler afterward — same order as Vaul.
    act(() => {
      trigger.focus();
      trigger.click();
    });

    assert.ok(
      document.querySelector('[role="dialog"][aria-modal="true"]'),
      "confirmation should be open",
    );
    // While confirm is open, dismissible is false — parent may still observe Escape.
    const parentEscapesBefore = parentCaptureEscapes;

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    assert.equal(
      document.querySelector('[role="dialog"][aria-modal="true"]'),
      null,
      "Escape must close the confirmation",
    );
    assert.equal(
      document.activeElement,
      trigger,
      "Escape cancel must restore focus to the Delete team trigger",
    );
    assert.ok(
      document.querySelector('[data-testid="modal-content"]'),
      "underlying editor must remain open because it is non-dismissible during confirmation",
    );
    assert.equal(
      document.querySelector('[data-testid="editor-closed"]'),
      null,
      "editor must not unmount on Escape while confirmation is open",
    );
    // Parent capture listener may correctly observe Escape (Radix registers first);
    // the guarantee is dismissible=false prevents dismiss — not that it never runs.
    assert.ok(
      parentCaptureEscapes > parentEscapesBefore,
      "parent/Radix capture listener is expected to observe Escape before ConfirmDialog",
    );
    assert.equal(confirmed, 0, "Escape must not dispatch the delete action");
    // Secondary: ConfirmDialog stopPropagation should keep Escape out of bubble phase.
    assert.equal(
      bubbleEscapes,
      0,
      "secondary: Escape should not reach bubble-phase listeners after ConfirmDialog handles it",
    );
  });

  it("sibling confirm outside modal content is not pointer-reachable (the P1 failure mode)", () => {
    mount(
      createElement(NestedDeleteFixture, {
        placeConfirm: "sibling",
        onConfirm: () => {},
      }),
    );

    const trigger = document.querySelector<HTMLButtonElement>('[data-testid="delete-trigger"]')!;
    act(() => {
      trigger.focus();
      trigger.click();
    });

    const confirmBtn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent === "Delete team" && b !== trigger,
    ) as HTMLButtonElement | undefined;
    assert.ok(confirmBtn, "sibling confirm still paints");
    assert.equal(
      isPointerReachable(confirmBtn),
      false,
      "sibling outside modal-content must not be pointer-reachable under Radix isolation",
    );
  });

  it("busy confirm does not double-dispatch", () => {
    let confirmed = 0;
    mount(
      createElement(
        RadixStyleModalShell,
        {
          overlay: createElement(ConfirmDialog, {
            contained: true,
            open: true,
            title: "Delete?",
            confirmLabel: "Delete team",
            tone: "danger",
            busy: true,
            onConfirm: () => {
              confirmed += 1;
            },
            onCancel: () => {},
          }),
        },
        createElement("span", null, "editor"),
      ),
    );

    const confirmBtn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent === "Working…",
    ) as HTMLButtonElement | undefined;
    assert.ok(confirmBtn);
    assert.ok(confirmBtn.disabled);

    act(() => {
      confirmBtn.click();
    });
    assert.equal(confirmed, 0);
  });
});
