"use client";

import Link from "next/link";
import {
  SETUP_STEPS,
  countIncompleteRequiredSteps,
  getNextSetupStep,
  isSetupStepDone,
  type SetupProgress,
} from "@/lib/admin-setup-checklist";
import { adminTournamentSelectHref } from "@/lib/admin-tournament-href";

type Props = {
  progress: SetupProgress;
  /** Current admin tournament slug — required so links re-bind cookies before navigation. */
  slug: string;
  /** Compact strip variant */
  compact?: boolean;
  onDismiss?: () => void;
  title?: string;
};

export function SetupChecklistPanel({
  progress,
  slug,
  compact = false,
  onDismiss,
  title = "Finish tournament setup",
}: Props) {
  const remainingRequired = countIncompleteRequiredSteps(progress);
  const next = getNextSetupStep(progress);
  const hrefFor = (path: string) => adminTournamentSelectHref(slug, path);

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm"
          : "rounded-xl border border-emerald-200 bg-emerald-50/90 p-5"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className={`font-semibold text-emerald-950 ${compact ? "text-sm" : "text-base"}`}>
            {title}
          </h2>
          {next ? (
            <p className={`mt-1 text-emerald-900/80 ${compact ? "text-xs" : "text-sm"}`}>
              {next.step.optional
                ? `Next (optional): ${next.step.title}`
                : `Step ${next.stepNumber} of ${next.totalRequired}: ${next.step.title}`}
              {remainingRequired > 0 && !next.step.optional
                ? ""
                : remainingRequired === 0 && next.step.optional
                  ? " — required setup is done."
                  : ""}
            </p>
          ) : (
            <p className={`mt-1 text-emerald-900/80 ${compact ? "text-xs" : "text-sm"}`}>
              Setup checklist complete.
            </p>
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

      {next ? (
        <div className={compact ? "mt-2" : "mt-4"}>
          <Link
            href={hrefFor(next.step.href)}
            className={`inline-flex items-center justify-center rounded-lg bg-emerald-600 font-semibold text-white hover:bg-emerald-700 ${
              compact ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm"
            }`}
          >
            {next.step.optional
              ? `${next.step.ctaLabel} →`
              : `Step ${next.stepNumber} of ${next.totalRequired}: ${next.step.ctaLabel} →`}
          </Link>
          {!compact ? (
            <p className="mt-2 text-xs text-emerald-900/70">{next.step.description}</p>
          ) : null}
        </div>
      ) : null}

      <ul className={`space-y-2 ${compact ? "mt-2" : "mt-4"}`}>
        {SETUP_STEPS.map((step) => {
          const done = isSetupStepDone(step.id, progress);
          const isNext = next?.step.id === step.id;
          return (
            <li
              key={step.id}
              className={`flex items-start gap-2 ${isNext && !compact ? "rounded-lg bg-white/70 px-2 py-1.5 ring-1 ring-emerald-200" : ""}`}
            >
              <span
                className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  done
                    ? "bg-emerald-600 text-white"
                    : isNext
                      ? "border-2 border-emerald-600 bg-white text-emerald-800"
                      : "border border-emerald-300 bg-white text-emerald-800"
                }`}
                aria-hidden
              >
                {done ? "✓" : step.optional ? "·" : ""}
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={hrefFor(step.href)}
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
