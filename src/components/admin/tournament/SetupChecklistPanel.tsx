"use client";

import Link from "next/link";
import {
  SETUP_STEPS,
  countIncompleteRequiredSteps,
  isSetupStepDone,
  type SetupProgress,
} from "@/lib/admin-setup-checklist";

type Props = {
  progress: SetupProgress;
  /** Compact strip variant */
  compact?: boolean;
  onDismiss?: () => void;
  title?: string;
};

export function SetupChecklistPanel({
  progress,
  compact = false,
  onDismiss,
  title = "Finish tournament setup",
}: Props) {
  const remaining = countIncompleteRequiredSteps(progress);

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm"
          : "rounded-xl border border-emerald-200 bg-emerald-50/90 p-5"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className={`font-semibold text-emerald-950 ${compact ? "text-sm" : "text-base"}`}>
            {title}
          </h2>
          {!compact ? (
            <p className="mt-1 text-xs text-emerald-900/80">
              Skeleton created. Complete these steps to get ready for game day
              {remaining > 0 ? ` (${remaining} remaining)` : ""}.
            </p>
          ) : remaining > 0 ? (
            <p className="text-xs text-emerald-900/80">{remaining} step{remaining === 1 ? "" : "s"} left</p>
          ) : (
            <p className="text-xs text-emerald-900/80">Required setup complete</p>
          )}
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md px-2 py-1 text-xs font-medium text-emerald-900/70 hover:bg-emerald-100 hover:text-emerald-950"
          >
            Dismiss
          </button>
        ) : null}
      </div>
      <ul className={`mt-3 space-y-2 ${compact ? "mt-2" : ""}`}>
        {SETUP_STEPS.map((step) => {
          const done = isSetupStepDone(step.id, progress);
          return (
            <li key={step.id} className="flex items-start gap-2">
              <span
                className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  done ? "bg-emerald-600 text-white" : "border border-emerald-300 bg-white text-emerald-800"
                }`}
                aria-hidden
              >
                {done ? "✓" : step.optional ? "·" : ""}
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={step.href}
                  className={`font-medium text-emerald-950 underline-offset-2 hover:underline ${
                    compact ? "text-xs" : "text-sm"
                  }`}
                >
                  {step.title}
                  {step.optional ? " (optional)" : ""}
                </Link>
                {!compact ? (
                  <p className="text-xs text-emerald-900/70">{step.description}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
