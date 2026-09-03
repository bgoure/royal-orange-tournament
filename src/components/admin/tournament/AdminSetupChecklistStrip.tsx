"use client";

import { useCallback, useSyncExternalStore } from "react";
import { SetupChecklistPanel } from "@/components/admin/tournament/SetupChecklistPanel";
import {
  countIncompleteSetupSteps,
  setupChecklistDismissKey,
  type SetupProgress,
} from "@/lib/admin-setup-checklist";

// `localStorage` is an external store: subscribing to it keeps the dismissed flag out of
// React state, so the first client render already knows whether the strip is hidden.
const dismissListeners = new Set<() => void>();
/** Fallback when `localStorage` is unavailable (private mode) so dismissing still sticks. */
const dismissedThisSession = new Set<string>();

function subscribeToDismissed(listener: () => void) {
  dismissListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    dismissListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readDismissed(slug: string): boolean {
  if (dismissedThisSession.has(slug)) return true;
  try {
    return localStorage.getItem(setupChecklistDismissKey(slug)) === "1";
  } catch {
    return false;
  }
}

function publishDismissed(slug: string) {
  dismissedThisSession.add(slug);
  try {
    localStorage.setItem(setupChecklistDismissKey(slug), "1");
  } catch {
    /* private mode / quota — the session fallback still hides the strip */
  }
  for (const listener of [...dismissListeners]) listener();
}

/** Hidden during SSR/hydration; the real flag lands on the first post-hydration render. */
function getDismissedServerSnapshot(): boolean {
  return true;
}

type Props = {
  slug: string;
  progress: SetupProgress;
  /** Full card (tournament settings) vs compact strip under header */
  variant?: "strip" | "card";
};

export function AdminSetupChecklistStrip({ slug, progress, variant = "strip" }: Props) {
  const dismissed = useSyncExternalStore(
    subscribeToDismissed,
    useCallback(() => readDismissed(slug), [slug]),
    getDismissedServerSnapshot,
  );

  const onDismiss = useCallback(() => {
    publishDismissed(slug);
  }, [slug]);

  // Keep guiding through optional steps (schedule / playoffs) until dismissed.
  const remaining = countIncompleteSetupSteps(progress);
  if (dismissed || remaining === 0) return null;

  if (variant === "card") {
    return (
      <SetupChecklistPanel
        slug={slug}
        progress={progress}
        onDismiss={onDismiss}
        title="Setup checklist"
      />
    );
  }

  return (
    <div className="border-b border-emerald-200 bg-emerald-50/50 px-4 py-2 sm:px-8">
      <SetupChecklistPanel
        slug={slug}
        progress={progress}
        compact
        onDismiss={onDismiss}
        title="Setup checklist"
      />
    </div>
  );
}
