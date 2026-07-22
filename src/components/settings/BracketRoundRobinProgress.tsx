"use client";

import { useActionState } from "react";
import {
  applyBracketResolution,
  resetPlayoffBracket,
  type BracketActionResult,
} from "@/app/admin/_actions/brackets";
import { ActionMessage } from "@/components/admin/structure/ActionMessage";
import { ConfirmForm } from "@/components/admin/structure/ConfirmForm";
import type { BracketProgressForPublicSettings } from "@/lib/services/bracket-public-settings";

const btnPrimary =
  "inline-flex min-h-[40px] items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm transition-colors hover:bg-zinc-50 active:opacity-90 disabled:cursor-not-allowed disabled:opacity-45 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700";

const btnDangerish =
  "inline-flex min-h-[40px] items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 shadow-sm transition-colors hover:bg-amber-100 active:opacity-90 disabled:cursor-not-allowed disabled:opacity-45 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60";

type Props = {
  tournamentId: string;
  rows: BracketProgressForPublicSettings[];
};

export function BracketRoundRobinProgress({ tournamentId, rows }: Props) {
  const [applyState, applyAction, applyPending] = useActionState(
    applyBracketResolution,
    undefined as BracketActionResult | undefined,
  );
  const [resetState, resetAction, resetPending] = useActionState(
    resetPlayoffBracket,
    undefined as BracketActionResult | undefined,
  );

  return (
    <div className="mt-3 space-y-5">
      <ActionMessage state={applyState} />
      <ActionMessage state={resetState} />
      {rows.map((row) => {
        const total = row.poolGamesTotal;
        const incomplete = row.poolGamesIncomplete;
        const complete = Math.max(0, total - incomplete);
        const pct = total > 0 ? Math.round((complete / total) * 100) : 0;
        const roundRobinComplete = total > 0 && incomplete === 0;
        const canPush = row.usesPoolSeeding && roundRobinComplete;
        const canReset = row.usesPoolSeeding ? roundRobinComplete : true;

        return (
          <div
            key={row.bracketId}
            className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-600 dark:bg-zinc-800/50"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {row.bracketName}
                <span className="font-normal text-zinc-500 dark:text-zinc-400"> · {row.divisionName}</span>
              </p>
              {row.needsResolutionRefresh && row.usesPoolSeeding ? (
                <span className="text-xs font-medium text-amber-800 dark:text-amber-200">
                  Standings changed — re-push when ready
                </span>
              ) : null}
            </div>

            {!row.usesPoolSeeding ? (
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                Teams were assigned when the bracket was created (or in Games). Pool round robin is not
                required for this bracket.
              </p>
            ) : total === 0 ? (
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                No pool games in this division yet. Schedule pool play before tracking progression.
              </p>
            ) : (
              <>
                <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                  Round robin:{" "}
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {complete}/{total} — {pct}% completed
                  </span>{" "}
                  (pool games must be final or cancelled, including any awaiting results cleared).
                </p>
                <div
                  className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Round robin completion"
                >
                  <div
                    className="h-full rounded-full bg-royal transition-[width] duration-300 dark:bg-royal-400"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {row.usesPoolSeeding ? (
                <form action={applyAction}>
                  <input type="hidden" name="tournamentId" value={tournamentId} />
                  <input type="hidden" name="bracketId" value={row.bracketId} />
                  <button type="submit" className={btnPrimary} disabled={!canPush || applyPending}>
                    {applyPending ? "Pushing…" : "Push to bracket"}
                  </button>
                </form>
              ) : null}
              <ConfirmForm
                action={resetAction}
                message={`Reset “${row.bracketName}” for ${row.divisionName}? Playoff and consolation games will be cleared to TBD so you can adjust pool results and push seeds again.`}
                className="inline"
              >
                <input type="hidden" name="tournamentId" value={tournamentId} />
                <input type="hidden" name="bracketId" value={row.bracketId} />
                <button type="submit" className={btnDangerish} disabled={!canReset || resetPending}>
                  {resetPending ? "Resetting…" : "Reset bracket"}
                </button>
              </ConfirmForm>
            </div>
          </div>
        );
      })}
    </div>
  );
}
