"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Division, Pool, PoolStanding, Team } from "@prisma/client";
import {
  disablePoolStandingsManualMode,
  enablePoolStandingsManualMode,
  savePoolAutoTiebreakRanks,
  savePoolManualStandingsRanks,
  type StandingsActionResult,
} from "@/app/admin/_actions/standings";
import { ActionMessage } from "@/components/admin/structure/ActionMessage";

type StandingRow = PoolStanding & { team: Team };

type PoolWithStandings = Pool & {
  division: Pick<Division, "name">;
  teams: Team[];
  standings: StandingRow[];
};

const inputClass =
  "w-20 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm tabular-nums text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";
const btnPrimary =
  "rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50";
const btnSecondary =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50";
const btnDanger =
  "rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50";

type Props = {
  pools: PoolWithStandings[];
  tournamentName: string;
  canConfigure: boolean;
};

export function StandingsRulesAdmin({ pools, tournamentName, canConfigure }: Props) {
  const [enableState, enableAction, enablePending] = useActionState(
    enablePoolStandingsManualMode,
    undefined as StandingsActionResult | undefined,
  );
  const [disableState, disableAction, disablePending] = useActionState(
    disablePoolStandingsManualMode,
    undefined as StandingsActionResult | undefined,
  );
  const [saveManualState, saveManualAction, saveManualPending] = useActionState(
    savePoolManualStandingsRanks,
    undefined as StandingsActionResult | undefined,
  );
  const [saveAutoState, saveAutoAction, saveAutoPending] = useActionState(
    savePoolAutoTiebreakRanks,
    undefined as StandingsActionResult | undefined,
  );

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Tournament</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Standings overrides</h1>
          <p className="mt-1 text-sm text-zinc-600">{tournamentName}</p>
        </div>
        <Link href="/standings" className={`${btnSecondary} inline-flex items-center`}>
          View public standings ↗
        </Link>
      </header>

      {!canConfigure ? (
        <p className="text-sm text-zinc-600">
          Only administrators can change tiebreak / manual ordering. Your role does not include{" "}
          <code className="rounded bg-zinc-100 px-1 text-xs">standings:configureRules</code>.
        </p>
      ) : (
        <p className="text-sm text-zinc-600">
          Use <strong>manual pool order</strong> for edge cases such as a team backing out after scores exist.
          Game stats still drive W–L–T and points; you only change the <em>row order</em>. Enabling manual mode
          copies the current automatic standings into rank numbers 1…n (edit as needed—for example move a
          withdrawn team last). Use <strong>tiebreak rank</strong> in automatic mode only when teams are tied on
          points (breaks ties before the coin placeholder).
        </p>
      )}

      <ActionMessage state={enableState} />
      <ActionMessage state={disableState} />
      <ActionMessage state={saveManualState} />
      <ActionMessage state={saveAutoState} />

      <div className="flex flex-col gap-12">
        {pools.map((pool) => {
          const saveAction = pool.standingsManualMode ? saveManualAction : saveAutoAction;
          const savePending = pool.standingsManualMode ? saveManualPending : saveAutoPending;
          const manual = pool.standingsManualMode;

          return (
            <section key={pool.id} className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-zinc-900">
                    {pool.division.name} · {pool.name}
                  </h2>
                  {manual ? (
                    <p className="mt-1 text-xs font-medium text-amber-800">
                      Manual order on — ranks set position in the table (1 = top; leave blank to group at the
                      bottom).
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-zinc-500">
                      Automatic tiebreakers. Optional tiebreak rank applies only when teams match on points.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {canConfigure && !manual && pool.teams.length > 0 ? (
                    <form action={enableAction}>
                      <input type="hidden" name="poolId" value={pool.id} />
                      <button type="submit" disabled={enablePending} className={btnPrimary}>
                        Use manual order…
                      </button>
                    </form>
                  ) : null}
                  {canConfigure && manual ? (
                    <form action={disableAction}>
                      <input type="hidden" name="poolId" value={pool.id} />
                      <button type="submit" disabled={disablePending} className={btnDanger}>
                        Restore automatic tiebreakers
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>

              {pool.teams.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-500">No teams in this pool.</p>
              ) : canConfigure ? (
                <form action={saveAction} className="mt-4">
                  <input type="hidden" name="poolId" value={pool.id} />
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left text-sm">
                      <thead className="border-b border-zinc-200 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                        <tr>
                          <th className="py-2 pr-4">#</th>
                          <th className="py-2 pr-4">Team</th>
                          <th className="py-2 pr-4">Pts</th>
                          <th className="py-2 pr-4">
                            {manual ? (
                              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                Manual rank
                              </span>
                            ) : (
                              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                Tiebreak rank (optional)
                              </span>
                            )}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {pool.standings.map((row, idx) => (
                          <tr key={row.teamId}>
                            <td className="py-2 pr-4 tabular-nums text-zinc-500">{idx + 1}</td>
                            <td className="py-2 pr-4 font-medium text-zinc-900">{row.team.name}</td>
                            <td className="py-2 pr-4 tabular-nums">{row.points}</td>
                            <td className="py-2 pr-4">
                              <input
                                className={inputClass}
                                name={`rank_${row.teamId}`}
                                type="number"
                                min={1}
                                step={1}
                                defaultValue={row.tiebreakOverrideRank ?? ""}
                                aria-label={
                                  manual
                                    ? `Manual rank for ${row.team.name}`
                                    : `Tiebreak rank for ${row.team.name}`
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4">
                    <button type="submit" disabled={savePending} className={btnSecondary}>
                      {manual ? "Save manual ranks" : "Save tiebreak ranks"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="border-b border-zinc-200 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                      <tr>
                        <th className="py-2 pr-4">#</th>
                        <th className="py-2 pr-4">Team</th>
                        <th className="py-2 pr-4">Pts</th>
                        <th className="py-2 pr-4">Override rank</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {pool.standings.map((row, idx) => (
                        <tr key={row.teamId}>
                          <td className="py-2 pr-4 tabular-nums text-zinc-500">{idx + 1}</td>
                          <td className="py-2 pr-4 font-medium text-zinc-900">{row.team.name}</td>
                          <td className="py-2 pr-4 tabular-nums">{row.points}</td>
                          <td className="py-2 pr-4 tabular-nums text-zinc-600">
                            {row.tiebreakOverrideRank ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
