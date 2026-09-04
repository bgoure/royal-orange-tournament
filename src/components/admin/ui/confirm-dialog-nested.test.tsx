/**
 * Regression: nested ConfirmDialog must remain interactive inside a Radix-style
 * modal content tree (pointer-events isolation). Sibling portals outside the
 * content node appear on top visually but cannot receive clicks/focus.
 *
 * Runs under jsdom via tsx — no browser driver required.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createElement, useState, type ReactNode } from "react";
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
