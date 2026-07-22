"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import type { BracketFormat } from "@prisma/client";
import {
  applyBracketResolution,
  createConsolationGameAction,
  createDivisionPlayoffBracketAction,
  deleteConsolationGameAction,
  deletePlayoffBracket,
  resetPlayoffBracket,
  toggleBracketPublished,
  updatePoolTeamsAdvancing,
  type BracketActionResult,
} from "@/app/admin/_actions/brackets";
import { ActionMessage } from "@/components/admin/structure/ActionMessage";
import { ConfirmForm } from "@/components/admin/structure/ConfirmForm";
import { formatJsDateAsDatetimeLocalInZone } from "@/lib/datetime-tournament";
import { formatFieldWithLocation } from "@/lib/field-display";
import { tournamentPathFromBase } from "@/lib/tournament-public-path";
import { classicSingleElimOrder } from "@/lib/services/bracket-engine";
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
  avoidRematchesUntilForced: boolean;
  published: boolean;
  needsResolutionRefresh: boolean;
  division: { id: string; name: string };
  _count: { rounds: number; games: number };
  poolGamesTotal: number;
  poolGamesIncomplete: number;
};

type ConsolationAdminRow = {
  id: string;
  scheduledAt: Date;
  schedulePlaceholder: boolean;
  gameNumber: string | null;
  division: { id: string; name: string } | null;
  field: { name: string; location: { name: string } };
  consolationHomePool: { id: string; name: string } | null;
  consolationAwayPool: { id: string; name: string } | null;
  consolationHomeRank: number | null;
  consolationAwayRank: number | null;
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
  consolationGames: ConsolationAdminRow[];
  tournamentName: string;
  /** Canonical public site base (`/{slug}` live or `/{folder}/{slug}` when archived). */
  publicSitePath: string;
  tournamentTimezone: string;
  canConfigure: boolean;
};

type FirstRoundSide = { poolId: string; rank: number } | { bye: true };
type FirstRoundSlot = { home: FirstRoundSide; away: FirstRoundSide };

function isByeSide(side: FirstRoundSide): side is { bye: true } {
  return "bye" in side && side.bye === true;
}

/**
 * Interleave pools by finish rank (pool #1 seeds, then pool #2 seeds, …) up to `entrySize` real
 * slots, then place them via classic single-elim seeding so any shortfall becomes BYEs on the
 * top seeds (standard tournament convention — see `classicSingleElimOrder`).
 */
function defaultFirstRound(pools: { id: string; teamCount: number }[], entrySize: number): FirstRoundSlot[] {
  const half = entrySize / 2;
  const realSlots: { poolId: string; rank: number }[] = [];
  if (pools.length > 0) {
    for (let rank = 1; realSlots.length < entrySize; rank++) {
      const before = realSlots.length;
      for (const p of pools) {
        if (realSlots.length >= entrySize) break;
        if (rank <= p.teamCount) realSlots.push({ poolId: p.id, rank });
      }
      if (realSlots.length === before) break; // no pool has a team at this rank — rest are byes
    }
  }
  const order = classicSingleElimOrder(entrySize);
  const sideFor = (seedIndex: number): FirstRoundSide =>
    seedIndex < realSlots.length ? realSlots[seedIndex]! : { bye: true };
  const out: FirstRoundSlot[] = [];
  for (let m = 0; m < half; m++) {
    out.push({ home: sideFor(order[m * 2]!), away: sideFor(order[m * 2 + 1]!) });
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

  const setSide = (index: number, side: "home" | "away", next: FirstRoundSide) => {
    setFirstRound((prev) => {
      const copy = [...prev];
      const row = { ...copy[index]! };
      row[side] = next;
      copy[index] = row;
      return copy;
    });
  };

  return (
    <>
      <input type="hidden" name="firstRound" value={JSON.stringify(firstRound)} />
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Round 1 pairings</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Set a side to BYE when the field is larger than the advancing total (auto-advances on seed apply).
        </p>
        <div className="mt-3 flex flex-col gap-4">
          {firstRound.map((row, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 text-sm text-zinc-800"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Game {idx + 1}</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {(["away", "home"] as const).map((side) => {
                  const s = row[side];
                  const bye = isByeSide(s);
                  return (
                    <div key={side}>
                      <p className={labelClass}>{side === "away" ? "Away" : "Home"}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <select
                          value={bye ? "__BYE__" : s.poolId}
                          onChange={(e) => {
                            if (e.target.value === "__BYE__") {
                              setSide(idx, side, { bye: true });
                            } else {
                              setSide(idx, side, {
                                poolId: e.target.value,
                                rank: bye ? 1 : s.rank,
                              });
                            }
                          }}
                          className={`${formClass} min-w-[140px]`}
                        >
                          <option value="__BYE__">BYE</option>
                          {poolRows.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        {!bye ? (
                          <select
                            value={s.rank}
                            onChange={(e) =>
                              setSide(idx, side, { poolId: s.poolId, rank: Number(e.target.value) })
                            }
                            className={`${formClass} w-24`}
                          >
                            {rankOptionsForPool(s.poolId).map((r) => (
                              <option key={r} value={r}>
                                #{r}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="self-center text-xs font-semibold text-amber-800">BYE</span>
                        )}
                      </div>
                    </div>
                  );
                })}
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
  consolationGames,
  tournamentName,
  publicSitePath,
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
  const [resetState, resetAction, resetPending] = useActionState(
    resetPlayoffBracket,
    undefined as BracketActionResult | undefined,
  );
  const [consolationCreateState, consolationCreateAction, consolationCreatePending] = useActionState(
    createConsolationGameAction,
    undefined as BracketActionResult | undefined,
  );
  const [consolationDeleteState, consolationDeleteAction, consolationDeletePending] = useActionState(
    deleteConsolationGameAction,
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
  const [createFormat, setCreateFormat] = useState<"SINGLE_ELIMINATION" | "DOUBLE_ELIMINATION">(
    "SINGLE_ELIMINATION",
  );

  const divisionsWithPools = useMemo(() => divisions.filter((d) => d.pools.length > 0), [divisions]);
  const [consolationDivisionId, setConsolationDivisionId] = useState(
    divisionsWithPools[0]?.id ?? "",
  );
  const consolationPools = useMemo(() => {
    const d = divisionsWithPools.find((x) => x.id === consolationDivisionId);
    return d?.pools ?? [];
  }, [divisionsWithPools, consolationDivisionId]);
  const [consolationHomePoolId, setConsolationHomePoolId] = useState(consolationPools[0]?.id ?? "");
  const [consolationAwayPoolId, setConsolationAwayPoolId] = useState(
    consolationPools[1]?.id ?? consolationPools[0]?.id ?? "",
  );

  const rankOptionsForPool = (poolId: string) => {
    const tc = consolationPools.find((p) => p.id === poolId)?.teamCount ?? 0;
    return Array.from({ length: Math.max(tc, 1) }, (_, i) => i + 1);
  };

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Tournament</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Brackets</h1>
          <p className="mt-1 text-sm text-zinc-600">{tournamentName}</p>
        </div>
        <div className="flex gap-2">
          <Link href={tournamentPathFromBase(publicSitePath, "brackets")} className={`${btnSecondary}`}>
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
          Playoffs are scoped to one division. First-round slots are labeled as &quot;kᵗʰ in pool&quot; when you create
          the bracket. After pool play finishes, use{" "}
          <strong className="font-medium text-zinc-800">Apply standings to seeds</strong> to fill those slots with
          the current standings (it does not rebuild the bracket tree). Re-apply if standings change.
        </p>
      )}

      <ActionMessage state={advState} />
      <ActionMessage state={createState} />
      <ActionMessage state={publishState} />
      <ActionMessage state={resolveState} />
      <ActionMessage state={deleteState} />
      <ActionMessage state={resetState} />
      <ActionMessage state={consolationCreateState} />
      <ActionMessage state={consolationDeleteState} />

      {canConfigure && divisionsWithPools.length > 0 && fields.length > 0 ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Consolation game (one game at a time)</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Non-bracket games labeled from pool finishing order. Teams fill when you apply standings on the playoff
            bracket for this division (same action as Round 1 seeds). Each pool finishing slot can only appear once
            per division.
          </p>
          <form action={consolationCreateAction} className="mt-4 flex flex-col gap-4">
            <div className="grid gap-3 sm:max-w-xl">
              <div>
                <label className={labelClass}>Division</label>
                <select
                  name="divisionId"
                  required
                  value={consolationDivisionId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setConsolationDivisionId(id);
                    const nextPools = divisionsWithPools.find((d) => d.id === id)?.pools ?? [];
                    setConsolationHomePoolId(nextPools[0]?.id ?? "");
                    setConsolationAwayPoolId(nextPools[1]?.id ?? nextPools[0]?.id ?? "");
                  }}
                  className={`${formClass} mt-1 w-full`}
                >
                  {divisionsWithPools.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
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
                <label className={labelClass}>Start ({tournamentTimezone})</label>
                <input
                  name="scheduledAt"
                  type="datetime-local"
                  required
                  defaultValue={defaultStart}
                  className={`${formClass} mt-1 w-full`}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="schedulePlaceholder"
                  value="1"
                  id="consolation-ph"
                  className="rounded border-zinc-300"
                />
                <label htmlFor="consolation-ph" className="text-sm text-zinc-700">
                  Show time as TBD on public site until confirmed
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className={labelClass}>Away slot</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <select
                      name="awayPoolId"
                      required
                      value={consolationAwayPoolId}
                      onChange={(e) => setConsolationAwayPoolId(e.target.value)}
                      className={`${formClass} min-w-[140px]`}
                    >
                      {consolationPools.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <select name="awayRank" required className={`${formClass} w-24`}>
                      {rankOptionsForPool(consolationAwayPoolId).map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <p className={labelClass}>Home slot</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <select
                      name="homePoolId"
                      required
                      value={consolationHomePoolId}
                      onChange={(e) => setConsolationHomePoolId(e.target.value)}
                      className={`${formClass} min-w-[140px]`}
                    >
                      {consolationPools.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <select name="homeRank" required className={`${formClass} w-24`}>
                      {rankOptionsForPool(consolationHomePoolId).map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <label className={labelClass}>Game ID / # (optional)</label>
                <input name="gameNumber" type="text" maxLength={64} className={`${formClass} mt-1 w-full`} />
              </div>
            </div>
            <button type="submit" disabled={consolationCreatePending} className={btnPrimary}>
              {consolationCreatePending ? "Adding…" : "Add consolation game"}
            </button>
          </form>

          {consolationGames.length > 0 ? (
            <ul className="mt-6 flex flex-col gap-3 border-t border-zinc-100 pt-6">
              {consolationGames.map((g) => (
                <li
                  key={g.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-zinc-900">{g.division?.name ?? "Division"}</p>
                    <p className="mt-1 text-xs text-zinc-600">
                      Away: {g.consolationAwayPool?.name ?? "?"} #{g.consolationAwayRank ?? "?"} · Home:{" "}
                      {g.consolationHomePool?.name ?? "?"} #{g.consolationHomeRank ?? "?"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {formatFieldWithLocation(g.field.name, g.field.location.name)}
                      {g.schedulePlaceholder ? " · TBD time" : ""}
                      {g.gameNumber ? ` · #${g.gameNumber}` : ""}
                    </p>
                  </div>
                  {canConfigure ? (
                    <form action={consolationDeleteAction}>
                      <input type="hidden" name="gameId" value={g.id} />
                      <button type="submit" disabled={consolationDeletePending} className={btnDanger}>
                        {consolationDeletePending ? "…" : "Remove"}
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-zinc-500">No consolation games yet.</p>
          )}
        </section>
      ) : null}

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
                  <label className={labelClass}>Format</label>
                  <select
                    name="format"
                    value={createFormat}
                    onChange={(e) =>
                      setCreateFormat(e.target.value as "SINGLE_ELIMINATION" | "DOUBLE_ELIMINATION")
                    }
                    className={`${formClass} mt-1 w-full`}
                  >
                    <option value="SINGLE_ELIMINATION">Single elimination</option>
                    <option value="DOUBLE_ELIMINATION">Double elimination</option>
                  </select>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Double-elim: losers drop into a losers bracket. Grand final is one game (no forced rematch
                    series). Triple elimination is not offered yet.
                  </p>
                </div>
                {createFormat === "DOUBLE_ELIMINATION" ? (
                  <div className="flex items-start gap-2 sm:col-span-2">
                    <input
                      type="checkbox"
                      name="avoidRematchesUntilForced"
                      value="1"
                      id="avoid-rematch"
                      className="mt-1 rounded border-zinc-300"
                    />
                    <label htmlFor="avoid-rematch" className="text-sm text-zinc-700">
                      <span className="font-medium">Avoid rematches until forced</span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        Losers-bracket matchups are re-drawn to prefer teams that have not played each other
                        yet. If every pairing is a rematch, a random optimal redraw is used.
                      </span>
                    </label>
                  </div>
                ) : null}
                <div>
                  <label className={labelClass}>Field size (bracket slots)</label>
                  <select
                    value={entrySize}
                    onChange={(e) => setEntrySize(Number(e.target.value))}
                    className={`${formClass} mt-1 w-full`}
                  >
                    {ENTRY_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n} slots (pad unused with BYE)
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
            Unpublished brackets stay hidden on the public site. Applying standings only runs when every pool game
            in that division is final or cancelled.{" "}
            <strong className="font-medium text-zinc-700">Reset bracket</strong> clears teams/scores on the existing
            tree (same pool-play requirement).{" "}
            <strong className="font-medium text-zinc-700">Delete bracket</strong> removes the playoff tree so you can
            run the create wizard again.
          </p>
          <ul className="mt-4 flex flex-col gap-4">
            {brackets.map((b) => {
              const rrComplete = b.poolGamesTotal > 0 && b.poolGamesIncomplete === 0;
              const complete = Math.max(0, b.poolGamesTotal - b.poolGamesIncomplete);
              const pct =
                b.poolGamesTotal > 0 ? Math.round((complete / b.poolGamesTotal) * 100) : 0;
              return (
              <li
                key={b.id}
                className={`rounded-lg border p-4 ${
                  b.needsResolutionRefresh
                    ? "border-amber-300 bg-amber-50/60"
                    : "border-zinc-100 bg-zinc-50/50"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900">
                      {b.name} · {b.division.name}
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">
                      {b.format === "DOUBLE_ELIMINATION"
                        ? "Double elimination"
                        : b.format === "TRIPLE_ELIMINATION"
                          ? "Triple elimination"
                          : "Single elimination"}
                      {b.avoidRematchesUntilForced ? " · avoid rematches" : ""} · {b._count.rounds} rounds ·{" "}
                      {b._count.games} games ·{" "}
                      {b.published ? (
                        <span className="font-medium text-emerald-700">Published</span>
                      ) : (
                        <span className="font-medium text-zinc-600">Hidden</span>
                      )}
                    </p>

                    {b.poolGamesTotal > 0 ? (
                      <div className="mt-3 max-w-md">
                        <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-zinc-600">
                          <span>
                            Pool play{" "}
                            <span className="font-medium text-zinc-800">
                              {complete}/{b.poolGamesTotal}
                            </span>{" "}
                            final or cancelled
                          </span>
                          <span className="tabular-nums text-zinc-500">{pct}%</span>
                        </div>
                        <div
                          className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zinc-200"
                          role="progressbar"
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`Pool play completion for ${b.division.name}`}
                        >
                          <div
                            className={`h-full rounded-full transition-[width] ${
                              rrComplete ? "bg-emerald-600" : "bg-amber-500"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-amber-800">
                        No pool games in this division yet — schedule pool play before seeding.
                      </p>
                    )}

                    <div className="mt-3 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-xs leading-relaxed text-zinc-600">
                      {b.needsResolutionRefresh ? (
                        <p className="font-medium text-amber-900">
                          Standings changed since the last apply — re-apply to refresh first-round and consolation
                          teams from current rankings.
                        </p>
                      ) : rrComplete ? (
                        <p>
                          <span className="font-medium text-emerald-800">Ready to seed.</span> Apply standings fills
                          Round 1 (and consolation) slots from pool standings. It does not change who plays whom by
                          rank — only which team sits in each existing &quot;kᵗʰ in pool&quot; slot.
                        </p>
                      ) : b.poolGamesTotal > 0 ? (
                        <p>
                          <span className="font-medium text-amber-900">
                            {b.poolGamesIncomplete} pool game{b.poolGamesIncomplete === 1 ? "" : "s"} still open.
                          </span>{" "}
                          Finish scoring under{" "}
                          <Link href="/admin/games?mode=scorekeeper" className="font-medium text-emerald-800 underline">
                            Scorekeeper
                          </Link>{" "}
                          or{" "}
                          <Link href="/admin/games" className="font-medium text-emerald-800 underline">
                            Games
                          </Link>{" "}
                          (final or cancelled) before applying seeds.
                        </p>
                      ) : (
                        <p>
                          Create pool games first, then return here to push standings into playoff seeds.
                        </p>
                      )}
                    </div>
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
                      <button
                        type="submit"
                        disabled={resolvePending || !rrComplete}
                        title={
                          !rrComplete
                            ? "Finish all pool games (final or cancelled) first"
                            : "Fill first-round teams from current pool standings"
                        }
                        className={rrComplete ? btnPrimary : btnSecondary}
                      >
                        {resolvePending
                          ? "Applying…"
                          : b.needsResolutionRefresh
                            ? "Re-apply standings to seeds"
                            : "Apply standings to seeds"}
                      </button>
                    </form>
                    <ConfirmForm
                      action={resetAction}
                      message={`Reset “${b.name}” for ${b.division.name}? This keeps the bracket but clears teams, scores, and sets bracket game statuses to SCHEDULED.`}
                      className="inline"
                    >
                      <input type="hidden" name="bracketId" value={b.id} />
                      <button type="submit" disabled={resetPending || !rrComplete} className={btnSecondary}>
                        {resetPending ? "Resetting…" : "Reset bracket"}
                      </button>
                    </ConfirmForm>
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
            );
            })}
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
