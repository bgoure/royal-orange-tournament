"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { BracketFormat, Pool } from "@prisma/client";
import {
  createPlayoffBracket,
  regeneratePlayoffBracket,
  updatePoolTeamsAdvancing,
  type BracketActionResult,
} from "@/app/admin/_actions/brackets";
import { ActionMessage } from "@/components/admin/structure/ActionMessage";
import { tournamentPath } from "@/lib/tournament-public-path";

type PoolRow = Pool & { division: { name: string } };

type BracketRow = {
  id: string;
  name: string;
  format: BracketFormat;
  _count: { rounds: number; games: number };
};

const formClass =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";
const labelClass = "text-[10px] font-semibold uppercase tracking-wide text-zinc-500";
const btnPrimary =
  "rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50";
const btnSecondary =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50";

function toDatetimeLocalValue(d: Date) {
  const x = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(x.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`;
}

type FieldSelectOption = { id: string; label: string };

type Props = {
  pools: PoolRow[];
  fields: FieldSelectOption[];
  brackets: BracketRow[];
  tournamentName: string;
  tournamentSlug: string;
  canConfigure: boolean;
};

export function BracketsAdmin({ pools, fields, brackets, tournamentName, tournamentSlug, canConfigure }: Props) {
  const [advState, advAction, advPending] = useActionState(
    updatePoolTeamsAdvancing,
    undefined as BracketActionResult | undefined,
  );
  const [createState, createAction, createPending] = useActionState(
    createPlayoffBracket,
    undefined as BracketActionResult | undefined,
  );
  const [regenState, regenAction, regenPending] = useActionState(
    regeneratePlayoffBracket,
    undefined as BracketActionResult | undefined,
  );

  const defaultStart = toDatetimeLocalValue(new Date());

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Tournament</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Brackets</h1>
          <p className="mt-1 text-sm text-zinc-600">{tournamentName}</p>
        </div>
        <div className="flex gap-2">
          <Link href={tournamentPath(tournamentSlug, "brackets")} className={`${btnSecondary}`}>
            Public brackets ↗
          </Link>
          <Link href="/admin/games" className={`${btnSecondary}`}>
            Games
          </Link>
        </div>
      </header>

      {!canConfigure ? (
        <p className="text-sm text-zinc-600">
          Only administrators can configure playoffs (<code className="rounded bg-zinc-100 px-1 text-xs">bracket:configure</code>
          ).
        </p>
      ) : (
        <p className="text-sm text-zinc-600">
          Set how many teams advance from each pool (by current standings order). Total advancers must be a power of 2
          (2, 4, 8…). Then create or regenerate a single-elimination bracket; round 1 is seeded from pools, later
          rounds fill when you mark games FINAL.
        </p>
      )}

      <ActionMessage state={advState} />
      <ActionMessage state={createState} />
      <ActionMessage state={regenState} />

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Advancing teams per pool</h2>
        <p className="mt-1 text-xs text-zinc-500">0 = this pool does not feed the playoff bracket.</p>
        <div className="mt-4 flex flex-col gap-3">
          {pools.length === 0 ? (
            <p className="text-sm text-zinc-500">No pools yet.</p>
          ) : (
            pools.map((p) =>
              canConfigure ? (
                <form
                  key={p.id}
                  action={advAction}
                  className="flex flex-wrap items-end gap-3 border-b border-zinc-100 pb-3 last:border-0"
                >
                  <input type="hidden" name="poolId" value={p.id} />
                  <div className="min-w-[200px] flex-1">
                    <p className="text-sm font-medium text-zinc-900">
                      {p.division.name} · {p.name}
                    </p>
                  </div>
                  <div>
                    <label className={labelClass}>Advancing</label>
                    <input
                      type="number"
                      name="teamsAdvancing"
                      min={0}
                      max={64}
                      defaultValue={p.teamsAdvancing}
                      className={`${formClass} mt-1 w-20`}
                    />
                  </div>
                  <button type="submit" disabled={advPending} className={`${btnSecondary} px-3 py-1.5 text-xs`}>
                    Save
                  </button>
                </form>
              ) : (
                <div
                  key={p.id}
                  className="flex flex-wrap items-end gap-3 border-b border-zinc-100 pb-3 last:border-0"
                >
                  <div className="min-w-[200px] flex-1">
                    <p className="text-sm font-medium text-zinc-900">
                      {p.division.name} · {p.name}
                    </p>
                  </div>
                  <div>
                    <span className={labelClass}>Advancing</span>
                    <p className="mt-1 tabular-nums text-sm text-zinc-700">{p.teamsAdvancing}</p>
                  </div>
                </div>
              ),
            )
          )}
        </div>
      </section>

      {canConfigure ? (
        <>
          <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">Create single-elimination bracket</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Uses current standings. Destructive only for a brand-new bracket row (no prior games linked).
            </p>
            <form action={createAction} className="mt-4 flex flex-col gap-4 sm:max-w-xl">
              <div>
                <label className={labelClass}>Name</label>
                <input name="name" required placeholder="Championship" className={`${formClass} mt-1 w-full`} />
              </div>
              <div>
                <label className={labelClass}>Field</label>
                <select name="fieldId" required className={`${formClass} mt-1 w-full`}>
                  <option value="">Select a field…</option>
                  {fields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>First-round start</label>
                <input
                  name="scheduledAt"
                  type="datetime-local"
                  required
                  defaultValue={defaultStart}
                  className={`${formClass} mt-1 w-full`}
                />
              </div>
              <div>
                <label className={labelClass}>Hours between rounds</label>
                <input
                  name="hoursBetweenRounds"
                  type="number"
                  min={0}
                  max={168}
                  defaultValue={2}
                  className={`${formClass} mt-1 w-24`}
                />
              </div>
              <button type="submit" disabled={createPending} className={btnPrimary}>
                {createPending ? "Generating…" : "Create bracket"}
              </button>
            </form>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-6">
            <h2 className="text-sm font-semibold text-zinc-900">Regenerate existing bracket</h2>
            <p className="mt-1 text-xs text-zinc-600">
              Deletes all games and rounds under the selected bracket and rebuilds from standings. Recorded playoff
              scores will be lost.
            </p>
            {brackets.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">No brackets yet.</p>
            ) : (
              <form action={regenAction} className="mt-4 flex flex-col gap-4 sm:max-w-xl">
                <div>
                  <label className={labelClass}>Bracket</label>
                  <select name="bracketId" required className={`${formClass} mt-1 w-full`}>
                    {brackets.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.format}) — {b._count.games} games
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Field</label>
                <select name="fieldId" required className={`${formClass} mt-1 w-full`}>
                  <option value="">Select a field…</option>
                  {fields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
                </div>
                <div>
                  <label className={labelClass}>First-round start</label>
                  <input
                    name="scheduledAt"
                    type="datetime-local"
                    required
                    defaultValue={defaultStart}
                    className={`${formClass} mt-1 w-full`}
                  />
                </div>
                <div>
                  <label className={labelClass}>Hours between rounds</label>
                  <input
                    name="hoursBetweenRounds"
                    type="number"
                    min={0}
                    max={168}
                    defaultValue={2}
                    className={`${formClass} mt-1 w-24`}
                  />
                </div>
                <button type="submit" disabled={regenPending} className={btnSecondary}>
                  {regenPending ? "Regenerating…" : "Regenerate bracket"}
                </button>
              </form>
            )}
          </section>
        </>
      ) : null}

      {brackets.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold text-zinc-900">Current brackets</h2>
          <ul className="mt-2 list-inside list-disc text-sm text-zinc-700">
            {brackets.map((b) => (
              <li key={b.id}>
                {b.name} — {b._count.rounds} rounds, {b._count.games} games
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
