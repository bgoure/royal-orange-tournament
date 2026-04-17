"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import type { BracketFormat } from "@prisma/client";
import {
  applyBracketResolution,
  createDivisionPlayoffBracketAction,
  deletePlayoffBracket,
  toggleBracketPublished,
  updatePoolTeamsAdvancing,
  type BracketActionResult,
} from "@/app/admin/_actions/brackets";
import { ActionMessage } from "@/components/admin/structure/ActionMessage";
import { ConfirmForm } from "@/components/admin/structure/ConfirmForm";
import { formatJsDateAsDatetimeLocalInZone } from "@/lib/datetime-tournament";
import { tournamentPath } from "@/lib/tournament-public-path";
import type { FirstRoundSlot } from "@/lib/services/bracket-division-build";
import type { Pool } from "@prisma/client";

type PoolRow = Pool & { division: { name: string } };

type DivisionWizardRow = {
  id: string;
  name: string;
  pools: { id: string; name: string; teamCount: number }[];
  hasBracket: boolean;
};

type BracketRow = {
  id: string;
  name: string;
  format: BracketFormat;
  published: boolean;
  needsResolutionRefresh: boolean;
  division: { id: string; name: string };
  _count: { rounds: number; games: number };
};

const ENTRY_OPTIONS = [2, 4, 8, 16, 32, 64] as const;

const formClass =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";
const labelClass = "text-[10px] font-semibold uppercase tracking-wide text-zinc-500";
const btnPrimary =
  "rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50";
const btnSecondary =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50";
const btnDanger =
  "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-900 hover:bg-red-100 disabled:opacity-50";

type FieldSelectOption = { id: string; label: string };

type Props = {
  pools: PoolRow[];
  divisions: DivisionWizardRow[];
  fields: FieldSelectOption[];
  brackets: BracketRow[];
  tournamentName: string;
  tournamentSlug: string;
  tournamentTimezone: string;
  canConfigure: boolean;
};

function defaultFirstRound(pools: { id: string; teamCount: number }[], entrySize: number): FirstRoundSlot[] {
  const pairs = entrySize / 2;
  const out: FirstRoundSlot[] = [];
  if (pools.length === 0) return out;
  if (pools.length >= 2) {
    const a = pools[0]!;
    const b = pools[1]!;
    for (let m = 0; m < pairs; m++) {
      const rank = m + 1;
      out.push({
        home: { poolId: a.id, rank: Math.min(rank, Math.max(1, a.teamCount)) },
        away: { poolId: b.id, rank: Math.min(rank, Math.max(1, b.teamCount)) },
      });
    }
    return out;
  }
  const p = pools[0]!;
  for (let m = 0; m < pairs; m++) {
    const r1 = m * 2 + 1;
    const r2 = m * 2 + 2;
    out.push({
      home: { poolId: p.id, rank: Math.min(r1, p.teamCount) },
      away: { poolId: p.id, rank: Math.min(r2, p.teamCount) },
    });
  }
  return out;
}

function PlayoffFirstRoundRows({
  poolRows,
  entrySize,
}: {
  poolRows: DivisionWizardRow["pools"];
  entrySize: number;
}) {
  const [firstRound, setFirstRound] = useState(() => defaultFirstRound(poolRows, entrySize));

  const rankOptionsForPool = (poolId: string) => {
    const tc = poolRows.find((p) => p.id === poolId)?.teamCount ?? 0;
    return Array.from({ length: Math.max(tc, 1) }, (_, i) => i + 1);
  };

  const updateSlot = (index: number, side: "home" | "away", key: "poolId" | "rank", value: string | number) => {
    setFirstRound((prev) => {
      const next = [...prev];
      const row = { ...next[index]! };
      const sideObj = { ...row[side] };
      if (key === "poolId") sideObj.poolId = value as string;
      else sideObj.rank = value as number;
      row[side] = sideObj;
      next[index] = row;
      return next;
    });
  };

  return (
    <>
      <input type="hidden" name="firstRound" value={JSON.stringify(firstRound)} />
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Round 1 pairings</h3>
        <div className="mt-3 flex flex-col gap-4">
          {firstRound.map((row, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 text-sm text-zinc-800"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Game {idx + 1}</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className={labelClass}>Away</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <select
                      value={row.away.poolId}
                      onChange={(e) => updateSlot(idx, "away", "poolId", e.target.value)}
                      className={`${formClass} min-w-[140px]`}
                    >
                      {poolRows.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={row.away.rank}
                      onChange={(e) => updateSlot(idx, "away", "rank", Number(e.target.value))}
                      className={`${formClass} w-24`}
                    >
                      {rankOptionsForPool(row.away.poolId).map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <p className={labelClass}>Home</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <select
                      value={row.home.poolId}
                      onChange={(e) => updateSlot(idx, "home", "poolId", e.target.value)}
                      className={`${formClass} min-w-[140px]`}
                    >
                      {poolRows.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={row.home.rank}
                      onChange={(e) => updateSlot(idx, "home", "rank", Number(e.target.value))}
                      className={`${formClass} w-24`}
                    >
                      {rankOptionsForPool(row.home.poolId).map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function BracketsAdmin({
  pools,
  divisions,
  fields,
  brackets,
  tournamentName,
  tournamentSlug,
  tournamentTimezone,
  canConfigure,
}: Props) {
  const [advState, advAction, advPending] = useActionState(
    updatePoolTeamsAdvancing,
    undefined as BracketActionResult | undefined,
  );
  const [createState, createAction, createPending] = useActionState(
    createDivisionPlayoffBracketAction,
    undefined as BracketActionResult | undefined,
  );
  const [publishState, publishAction, publishPending] = useActionState(
    toggleBracketPublished,
    undefined as BracketActionResult | undefined,
  );
  const [resolveState, resolveAction, resolvePending] = useActionState(
    applyBracketResolution,
    undefined as BracketActionResult | undefined,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deletePlayoffBracket,
    undefined as BracketActionResult | undefined,
  );

  const defaultStart = formatJsDateAsDatetimeLocalInZone(new Date(), tournamentTimezone);

  const creatableDivisions = useMemo(() => divisions.filter((d) => !d.hasBracket), [divisions]);

  const [wizardDivisionId, setWizardDivisionId] = useState(creatableDivisions[0]?.id ?? "");

  const effectiveDivisionId = useMemo(() => {
    if (creatableDivisions.some((d) => d.id === wizardDivisionId)) return wizardDivisionId;
    return creatableDivisions[0]?.id ?? "";
  }, [creatableDivisions, wizardDivisionId]);

  const selectedDivision = useMemo(
    () => divisions.find((d) => d.id === effectiveDivisionId),
    [divisions, effectiveDivisionId],
  );

  const [entrySize, setEntrySize] = useState<number>(8);

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
          Only administrators can configure playoffs (
          <code className="rounded bg-zinc-100 px-1 text-xs">bracket:configure</code>).
        </p>
      ) : (
        <p className="text-sm text-zinc-600">
          Playoffs are scoped to one division at a time. Choose first-round pairings as &quot;kᵗʰ in pool&quot;
          slots, then publish when you are ready for the public site. Pool standings can change the seed list;
          re-apply standings after round-robin updates.
        </p>
      )}

      <ActionMessage state={advState} />
      <ActionMessage state={createState} />
      <ActionMessage state={publishState} />
      <ActionMessage state={resolveState} />
      <ActionMessage state={deleteState} />

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Advancing teams per pool</h2>
        <p className="mt-1 text-xs text-zinc-500">0 = this pool does not feed pool standings ranks for seed labels.</p>
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

      {canConfigure && creatableDivisions.length > 0 ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Create division playoff (wizard)</h2>
          <p className="mt-1 text-xs text-zinc-500">
            One single-elimination bracket per division. First round uses pool finishing order (1 = top of
            standings). You can publish even while times still show as TBD.
          </p>
          {selectedDivision ? (
            <form action={createAction} className="mt-4 flex flex-col gap-5">
              <div className="grid gap-4 sm:max-w-xl">
                <div>
                  <label className={labelClass}>Division</label>
                  <select
                    name="divisionId"
                    required
                    value={effectiveDivisionId}
                    onChange={(e) => setWizardDivisionId(e.target.value)}
                    className={`${formClass} mt-1 w-full`}
                  >
                    {creatableDivisions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Bracket name</label>
                  <input name="name" required placeholder="Championship" className={`${formClass} mt-1 w-full`} />
                </div>
                <div>
                  <label className={labelClass}>Placeholder field (first round)</label>
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
                  <label className={labelClass}>Field size (teams)</label>
                  <select
                    value={entrySize}
                    onChange={(e) => setEntrySize(Number(e.target.value))}
                    className={`${formClass} mt-1 w-full`}
                  >
                    {ENTRY_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n} teams
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>First-round start ({tournamentTimezone})</label>
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
                <div className="flex items-center gap-2">
                  <input type="checkbox" name="published" value="1" id="pub-new" className="rounded border-zinc-300" />
                  <label htmlFor="pub-new" className="text-sm text-zinc-700">
                    Publish to public site immediately
                  </label>
                </div>
              </div>

              <PlayoffFirstRoundRows
                key={`${effectiveDivisionId}-${entrySize}`}
                poolRows={selectedDivision.pools}
                entrySize={entrySize}
              />

              <button type="submit" disabled={createPending || !selectedDivision} className={btnPrimary}>
                {createPending ? "Creating…" : "Create bracket"}
              </button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">All divisions already have a playoff bracket.</p>
          )}
        </section>
      ) : null}

      {canConfigure && brackets.length > 0 ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Playoff brackets</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Unpublished brackets stay hidden on the public site. “Apply standings” only runs when every pool game
            in that division is final or cancelled (round robin finished). Use it after pool play changes.{" "}
            <strong className="font-medium text-zinc-700">Delete bracket</strong> removes the playoff tree and all
            its games so you can run the create wizard again.
          </p>
          <ul className="mt-4 flex flex-col gap-4">
            {brackets.map((b) => (
              <li key={b.id} className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">
                      {b.name} · {b.division.name}
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">
                      {b._count.rounds} rounds · {b._count.games} games ·{" "}
                      {b.published ? (
                        <span className="font-medium text-emerald-700">Published</span>
                      ) : (
                        <span className="font-medium text-zinc-600">Hidden</span>
                      )}
                      {b.needsResolutionRefresh ? (
                        <span className="ml-2 text-amber-800">· Standings changed — re-apply</span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <form action={publishAction}>
                      <input type="hidden" name="bracketId" value={b.id} />
                      <input type="hidden" name="published" value={b.published ? "0" : "1"} />
                      <button type="submit" disabled={publishPending} className={btnSecondary}>
                        {b.published ? "Unpublish" : "Publish"}
                      </button>
                    </form>
                    <form action={resolveAction}>
                      <input type="hidden" name="bracketId" value={b.id} />
                      <button type="submit" disabled={resolvePending} className={btnSecondary}>
                        {resolvePending ? "Applying…" : "Apply standings to seeds"}
                      </button>
                    </form>
                    <ConfirmForm
                      action={deleteAction}
                      message={`Delete “${b.name}” for ${b.division.name}? All playoff games for this bracket will be removed.`}
                      className="inline"
                    >
                      <input type="hidden" name="bracketId" value={b.id} />
                      <button type="submit" disabled={deletePending} className={btnDanger}>
                        {deletePending ? "Deleting…" : "Delete bracket"}
                      </button>
                    </ConfirmForm>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {brackets.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold text-zinc-900">All playoff brackets</h2>
          <ul className="mt-2 list-inside list-disc text-sm text-zinc-700">
            {brackets.map((b) => (
              <li key={b.id}>
                {b.division.name} — {b.name} · {b._count.rounds} rounds, {b._count.games} games
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
