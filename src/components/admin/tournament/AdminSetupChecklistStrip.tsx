"use client";

import { useCallback, useEffect, useState } from "react";
import { SetupChecklistPanel } from "@/components/admin/tournament/SetupChecklistPanel";
import {
  countIncompleteRequiredSteps,
  setupChecklistDismissKey,
  type SetupProgress,
} from "@/lib/admin-setup-checklist";

type Props = {
  slug: string;
  progress: SetupProgress;
};

export function AdminSetupChecklistStrip({ slug, progress }: Props) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(setupChecklistDismissKey(slug)) === "1");
    } catch {
      setDismissed(false);
    }
  }, [slug]);

  const onDismiss = useCallback(() => {
    try {
      localStorage.setItem(setupChecklistDismissKey(slug), "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }, [slug]);

  const remaining = countIncompleteRequiredSteps(progress);
  if (dismissed || remaining === 0) return null;

  return (
    <div className="border-b border-emerald-200 bg-emerald-50/50 px-8 py-2">
      <SetupChecklistPanel progress={progress} compact onDismiss={onDismiss} title="Setup checklist" />
    </div>
  );
}
