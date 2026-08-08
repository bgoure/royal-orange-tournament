"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
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
import {
  BracketFeederEditor,
  type FeederMatchRow,
} from "@/components/admin/brackets/BracketFeederEditor";
import { formatJsDateAsDatetimeLocalInZone } from "@/lib/datetime-tournament";
import { formatFieldWithLocation } from "@/lib/field-display";
import { tournamentPathFromBase } from "@/lib/tournament-public-path";
import { classicSingleElimOrder } from "@/lib/services/bracket-engine";
import { isObaDePresetKey, type ObaDePresetKey } from "@/lib/brackets/oba-de-presets";
import type { GrandFinalMode, Pool } from "@prisma/client";

function seededDePresetForTeamCount(n: number): ObaDePresetKey | null {
  const key = `oba_de_${n}`;
  return isObaDePresetKey(key) ? key : null;
}

type PoolRow = Pool & { division: { name: string } };

type DivisionWizardRow = {
  id: string;
  name: string;
  pools: {
    id: string;
    name: string;
    teamCount: number;
    teams: { id: string; name: string }[];
  }[];
  hasBracket: boolean;
};

type BracketRow = {
  id: string;
  name: string;
  format: BracketFormat;
  avoidRematchesUntilForced: boolean;
  grandFinalMode: GrandFinalMode;
  isQualifier: boolean;
  qualifyingTeamCount: number;
  published: boolean;
  needsResolutionRefresh: boolean;
  division: { id: string; name: string };
  _count: { rounds: number; games: number };
  poolGamesTotal: number;
  poolGamesIncomplete: number;
  usesPoolSeeding: boolean;
};

type FeederBracketRow = {
  bracketId: string;
  bracketName: string;
  matches: FeederMatchRow[];
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
  feederBrackets?: FeederBracketRow[];
  tournamentName: string;
  /** Canonical public site base (`/{slug}` live or `/{folder}/{slug}` when archived). */
  publicSitePath: string;
  tournamentTimezone: string;
  canConfigure: boolean;
};

type FirstRoundSide = { poolId: string; rank: number } | { teamId: string } | { bye: true };
type FirstRoundSlot = { home: FirstRoundSide; away: FirstRoundSide };

function isByeSide(side: FirstRoundSide): side is { bye: true } {
  return "bye" in side && side.bye === true;
}

function isTeamSide(side: FirstRoundSide): side is { teamId: string } {
  return "teamId" in side;
}

function isPoolSide(side: FirstRoundSide): side is { poolId: string; rank: number } {
  return "poolId" in side;
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

function defaultFirstRoundTeams(
  teams: { id: string; name: string }[],
  entrySize: number,
): FirstRoundSlot[] {
  const half = entrySize / 2;
  const realSlots = teams.slice(0, entrySize).map((t) => ({ teamId: t.id }));
  const order = classicSingleElimOrder(entrySize);
  const sideFor = (seedIndex: number): FirstRoundSide =>
    seedIndex < realSlots.length ? realSlots[seedIndex]! : { bye: true };
  const out: FirstRoundSlot[] = [];
  for (let m = 0; m < half; m++) {
    out.push({ home: sideFor(order[m * 2]!), away: sideFor(order[m * 2 + 1]!) });
  }
  return out;
}

function SeedOrderRows({
  teams,
  presetKey,
}: {
  teams: { id: string; name: string; poolName: string }[];
  presetKey: ObaDePresetKey;
}) {
  const n = Number(presetKey.replace("oba_de_", ""));
  const [seedIds, setSeedIds] = useState(() => teams.slice(0, n).map((t) => t.id));

  useEffect(() => {
    setSeedIds(teams.slice(0, n).map((t) => t.id));
  }, [teams, n]);

  return (
    <>
      <input type="hidden" name="formatPreset" value={presetKey} />
      <input type="hidden" name="seedTeamIds" value={JSON.stringify(seedIds)} />
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Seed order</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Seed 1 = strongest. For 5–6 teams, top seeds receive Round 1 byes (no BYE game cards). Public
          view uses Round 1, Round 2, … columns with G# Winner / G# Loser placeholders.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {Array.from({ length: n }, (_, i) => (
            <div key={i}>
              <p className={labelClass}>Seed {i + 1}</p>
              <select
                value={seedIds[i] ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setSeedIds((prev) => {
                    const next = [...prev];
                    while (next.length < n) next.push("");
                    next[i] = v;
                    return next;
                  });
                }}
                className={`${formClass} mt-1 w-full`}
                required
              >
                <option value="">Select team…</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.poolName})
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function PlayoffFirstRoundRows({
  seedMode,
  poolRows,
  teams,
  entrySize,
}: {
  seedMode: "pool_standings" | "assign_teams";
  poolRows: DivisionWizardRow["pools"];
  teams: { id: string; name: string; poolName: string }[];
  entrySize: number;
}) {
  const [firstRound, setFirstRound] = useState(() =>
    seedMode === "assign_teams"
      ? defaultFirstRoundTeams(
          teams.map((t) => ({ id: t.id, name: t.name })),
          entrySize,
        )
      : defaultFirstRound(poolRows, entrySize),
  );

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
          {seedMode === "assign_teams"
            ? "Pick teams now (or BYE). Format and pairing style do not require pool round robin."
            : "Label sides as finishing place in a pool. Teams fill after pool play when you Apply standings."}
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
                  if (seedMode === "assign_teams") {
                    const teamId = isTeamSide(s) ? s.teamId : "";
                    return (
                      <div key={side}>
                        <p className={labelClass}>{side === "away" ? "Away" : "Home"}</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <select
                            value={bye ? "__BYE__" : teamId}
                            onChange={(e) => {
                              if (e.target.value === "__BYE__") {
                                setSide(idx, side, { bye: true });
                              } else {
                                setSide(idx, side, { teamId: e.target.value });
                              }
                            }}
                            className={`${formClass} min-w-[180px]`}
                          >
                            <option value="__BYE__">BYE</option>
                            {teams.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({t.poolName})
                              </option>
                            ))}
                          </select>
                          {bye ? (
                            <span className="self-center text-xs font-semibold text-amber-800">BYE</span>
                          ) : null}
                        </div>
                      </div>
                    );
                  }
                  const poolId = isPoolSide(s) ? s.poolId : poolRows[0]?.id ?? "";
                  const rank = isPoolSide(s) ? s.rank : 1;
                  return (
                    <div key={side}>
                      <p className={labelClass}>{side === "away" ? "Away" : "Home"}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <select
                          value={bye ? "__BYE__" : poolId}
                          onChange={(e) => {
                            if (e.target.value === "__BYE__") {
                              setSide(idx, side, { bye: true });
                            } else {
                              setSide(idx, side, {
                                poolId: e.target.value,
                                rank: bye ? 1 : rank,
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
                            value={rank}
                            onChange={(e) =>
                              setSide(idx, side, { poolId, rank: Number(e.target.value) })
                            }
                            className={`${formClass} w-24`}
                          >
                            {rankOptionsForPool(poolId).map((r) => (
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
  feederBrackets = [],
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
  const [createFormat, setCreateFormat] = useState<
    "SINGLE_ELIMINATION" | "DOUBLE_ELIMINATION" | "TRIPLE_ELIMINATION"
  >("SINGLE_ELIMINATION");
  const [pairingMode, setPairingMode] = useState<"classic" | "avoid_rematches">("classic");
  const [grandFinalMode, setGrandFinalMode] = useState<"SINGLE" | "IF_NECESSARY">("SINGLE");
  const [isQualifier, setIsQualifier] = useState(false);
  const [qualifyingTeamCount, setQualifyingTeamCount] = useState(2);
  const [seedMode, setSeedMode] = useState<"pool_standings" | "assign_teams">("pool_standings");

  const divisionTeams = useMemo(() => {
    if (!selectedDivision) return [];
    return selectedDivision.pools.flatMap((p) =>
      p.teams.map((t) => ({ id: t.id, name: t.name, poolName: p.name })),
    );
  }, [selectedDivision]);

  const seededDePreset =
    createFormat === "DOUBLE_ELIMINATION"
      ? seededDePresetForTeamCount(divisionTeams.length)
      : null;

  useEffect(() => {
    if (!selectedDivision) return;
    if (seededDePreset) {
      setSeedMode("assign_teams");
      setGrandFinalMode("IF_NECESSARY");
      return;
    }
    if (selectedDivision.pools.length === 0 && divisionTeams.length > 0) {
      setSeedMode("assign_teams");
    } else if (selectedDivision.pools.length > 0 && seedMode === "assign_teams" && divisionTeams.length === 0) {
      setSeedMode("pool_standings");
    } else if (selectedDivision.pools.length === 0) {
      setSeedMode("assign_teams");
    }
    // Only re-evaluate when the division (or its teams) changes — not on every seedMode toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: seedMode is written, not read for branching beyond defaults
  }, [selectedDivision, divisionTeams.length, seededDePreset]);

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
          Playoffs are scoped to one division. Choose single, double, or triple elimination (and classic vs
          avoid-duplicates for multi-elim) whether or not pool round robin exists. Seed Round 1 from pool
          standings after RR, or assign teams now. For pool-seeded brackets, use{" "}
          <strong className="font-medium text-zinc-800">Apply standings to seeds</strong> after pool play
          finishes.
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
            One bracket per division. Pick format and losers pairing style anytime — round robin is optional.
            Seed from pool finishing places after RR, or assign teams at create.
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
                      setCreateFormat(
                        e.target.value as
                          | "SINGLE_ELIMINATION"
                          | "DOUBLE_ELIMINATION"
                          | "TRIPLE_ELIMINATION",
                      )
                    }
                    className={`${formClass} mt-1 w-full`}
                  >
                    <option value="SINGLE_ELIMINATION">Single elimination</option>
                    <option value="DOUBLE_ELIMINATION">Double elimination</option>
                    <option value="TRIPLE_ELIMINATION">Triple elimination</option>
                  </select>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {createFormat === "SINGLE_ELIMINATION"
                      ? "One loss eliminates. Pad the field to a power of 2 with BYEs."
                      : createFormat === "DOUBLE_ELIMINATION" && seededDePreset
                        ? `This division has ${divisionTeams.length} teams — creates a Round 1–N seeded double-elim workbook (implicit byes, G# Winner/Loser labels).`
                        : createFormat === "DOUBLE_ELIMINATION"
                          ? "One-loss losers bracket + grand final. For 4–7 teams, use a division with that exact team count for the seeded Round N workbook."
                          : "Three lives: W → L1 (1 loss) → L2 (2 losses). L2 champ meets W champ in the grand final."}
                  </p>
                </div>
                {seededDePreset ? (
                  <input type="hidden" name="grandFinalMode" value="IF_NECESSARY" />
                ) : createFormat === "DOUBLE_ELIMINATION" || createFormat === "TRIPLE_ELIMINATION" ? (
                  <div className="sm:col-span-2">
                    <p className={labelClass}>Grand final</p>
                    <div className="mt-2 flex flex-col gap-2">
                      <label className="flex items-start gap-2 text-sm text-zinc-700">
                        <input
                          type="radio"
                          name="grandFinalMode"
                          value="SINGLE"
                          checked={grandFinalMode === "SINGLE"}
                          onChange={() => setGrandFinalMode("SINGLE")}
                          className="mt-1"
                        />
                        <span>
                          <span className="font-medium">Single game</span>
                          <span className="mt-0.5 block text-xs text-zinc-500">
                            One grand final — losers-bracket champ can win the tournament in one game.
                          </span>
                        </span>
                      </label>
                      <label className="flex items-start gap-2 text-sm text-zinc-700">
                        <input
                          type="radio"
                          name="grandFinalMode"
                          value="IF_NECESSARY"
                          checked={grandFinalMode === "IF_NECESSARY"}
                          onChange={() => setGrandFinalMode("IF_NECESSARY")}
                          className="mt-1"
                        />
                        <span>
                          <span className="font-medium">If necessary (true double-elim)</span>
                          <span className="mt-0.5 block text-xs text-zinc-500">
                            If the losers-bracket champ beats the undefeated team, play a second final.
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <input type="hidden" name="grandFinalMode" value="SINGLE" />
                )}
                <div className="sm:col-span-2 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3">
                  <label className="flex items-start gap-2 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      name="isQualifier"
                      value="1"
                      checked={isQualifier}
                      onChange={(e) => setIsQualifier(e.target.checked)}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-medium">Qualifier tournament</span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        Conclude when N teams remain alive (e.g. send 2 teams to the next event). Remaining
                        games are not required once those spots are locked.
                      </span>
                    </span>
                  </label>
                  {isQualifier ? (
                    <div className="mt-3">
                      <label className={labelClass} htmlFor="qualifyingTeamCount">
                        Teams that advance / remain
                      </label>
                      <input
                        id="qualifyingTeamCount"
                        name="qualifyingTeamCount"
                        type="number"
                        min={1}
                        max={64}
                        value={qualifyingTeamCount}
                        onChange={(e) => setQualifyingTeamCount(Number(e.target.value) || 1)}
                        className={`${formClass} mt-1 w-24`}
                      />
                    </div>
                  ) : (
                    <input type="hidden" name="qualifyingTeamCount" value="1" />
                  )}
                </div>
                {!seededDePreset &&
                (createFormat === "DOUBLE_ELIMINATION" || createFormat === "TRIPLE_ELIMINATION") ? (
                  <div className="sm:col-span-2">
                    <p className={labelClass}>Losers pairing</p>
                    <div className="mt-2 flex flex-col gap-2">
                      <label className="flex items-start gap-2 text-sm text-zinc-700">
                        <input
                          type="radio"
                          name="pairingMode"
                          value="classic"
                          checked={pairingMode === "classic"}
                          onChange={() => setPairingMode("classic")}
                          className="mt-1"
                        />
                        <span>
                          <span className="font-medium">Classic fixed bracket</span>
                          <span className="mt-0.5 block text-xs text-zinc-500">
                            Straight double/triple paths — drop into predetermined slots (printable
                            feeder lines).
                          </span>
                        </span>
                      </label>
                      <label className="flex items-start gap-2 text-sm text-zinc-700">
                        <input
                          type="radio"
                          name="pairingMode"
                          value="avoid_rematches"
                          checked={pairingMode === "avoid_rematches"}
                          onChange={() => setPairingMode("avoid_rematches")}
                          className="mt-1"
                        />
                        <span>
                          <span className="font-medium">Avoid duplicate matchups</span>
                          <span className="mt-0.5 block text-xs text-zinc-500">
                            Re-draw open losers / L2 rounds so teams that already played each other
                            are paired last. If every pairing is a rematch, a random optimal redraw is
                            used (same idea as the 27-team poster). Odd-round byes follow OBA
                            RP5.2: no back-to-back byes, no second bye until all have one, undefeated
                            preferred, then RP7.3 (draw if more than two still tied).
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>
                ) : null}
                {!seededDePreset ? (
                  <div className="sm:col-span-2">
                    <p className={labelClass}>Round 1 seeding</p>
                    <div className="mt-2 flex flex-col gap-2">
                      <label className="flex items-start gap-2 text-sm text-zinc-700">
                        <input
                          type="radio"
                          name="seedMode"
                          value="pool_standings"
                          checked={seedMode === "pool_standings"}
                          onChange={() => setSeedMode("pool_standings")}
                          className="mt-1"
                          disabled={!selectedDivision || selectedDivision.pools.length === 0}
                        />
                        <span>
                          <span className="font-medium">From pool standings (after round robin)</span>
                          <span className="mt-0.5 block text-xs text-zinc-500">
                            Label slots as kᵗʰ in pool. Apply standings fills teams when pool play is
                            complete.
                          </span>
                        </span>
                      </label>
                      <label className="flex items-start gap-2 text-sm text-zinc-700">
                        <input
                          type="radio"
                          name="seedMode"
                          value="assign_teams"
                          checked={seedMode === "assign_teams"}
                          onChange={() => setSeedMode("assign_teams")}
                          className="mt-1"
                          disabled={divisionTeams.length === 0}
                        />
                        <span>
                          <span className="font-medium">Assign teams now</span>
                          <span className="mt-0.5 block text-xs text-zinc-500">
                            No round robin required — pick Round 1 teams (or BYEs) immediately. Edit
                            later under Games if needed.
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>
                ) : null}
                {!seededDePreset ? (
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
                ) : null}
                <div>
                  <label className={labelClass}>Suggested first-round start ({tournamentTimezone})</label>
                  <input
                    name="scheduledAt"
                    type="datetime-local"
                    required
                    defaultValue={defaultStart}
                    className={`${formClass} mt-1 w-full`}
                  />
                  <p className="mt-1 text-[10px] text-zinc-500">
                    Games stay TBD until you set each slot under Games — this does not book the field for every
                    division.
                  </p>
                </div>
                <div>
                  <label className={labelClass}>Hours between rounds (seed spacing)</label>
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

              {seededDePreset ? (
                <SeedOrderRows
                  key={`${effectiveDivisionId}-${seededDePreset}`}
                  teams={divisionTeams}
                  presetKey={seededDePreset}
                />
              ) : (
                <PlayoffFirstRoundRows
                  key={`${effectiveDivisionId}-${entrySize}-${seedMode}`}
                  seedMode={seedMode}
                  poolRows={selectedDivision.pools}
                  teams={divisionTeams}
                  entrySize={entrySize}
                />
              )}

              <button
                type="submit"
                disabled={
                  createPending ||
                  !selectedDivision ||
                  (seededDePreset
                    ? divisionTeams.length === 0
                    : (seedMode === "pool_standings" && selectedDivision.pools.length === 0) ||
                      (seedMode === "assign_teams" && divisionTeams.length === 0))
                }
                className={btnPrimary}
              >
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
            Unpublished brackets stay hidden on the public site. For pool-seeded brackets, Apply standings
            runs when every pool game in that division is final or cancelled.{" "}
            <strong className="font-medium text-zinc-700">Reset bracket</strong> clears teams/scores on the
            existing tree. <strong className="font-medium text-zinc-700">Delete bracket</strong> removes the
            playoff tree so you can run the create wizard again.
          </p>
          <ul className="mt-4 flex flex-col gap-4">
            {brackets.map((b) => {
              const rrComplete = b.poolGamesTotal > 0 && b.poolGamesIncomplete === 0;
              const canApplyStandings = b.usesPoolSeeding && rrComplete;
              const canReset = b.usesPoolSeeding ? rrComplete : true;
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
                      {b.avoidRematchesUntilForced ? " · avoid duplicate matchups" : b.format !== "SINGLE_ELIMINATION" ? " · classic paths" : ""}
                      {b.format !== "SINGLE_ELIMINATION"
                        ? b.grandFinalMode === "IF_NECESSARY"
                          ? " · if-necessary GF"
                          : " · single GF"
                        : ""}
                      {b.isQualifier ? ` · qualifier (top ${b.qualifyingTeamCount})` : ""}
                      {b.usesPoolSeeding ? " · pool-seeded" : " · teams assigned"} · {b._count.rounds} rounds ·{" "}
                      {b._count.games} games ·{" "}
                      {b.published ? (
                        <span className="font-medium text-emerald-700">Published</span>
                      ) : (
                        <span className="font-medium text-zinc-600">Hidden</span>
                      )}
                    </p>

                    {b.usesPoolSeeding && b.poolGamesTotal > 0 ? (
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
                    ) : b.usesPoolSeeding ? (
                      <p className="mt-2 text-xs text-amber-800">
                        No pool games in this division yet — schedule pool play before applying standings.
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-zinc-600">
                        Round 1 teams were assigned at create (or in Games). Pool round robin is not required.
                      </p>
                    )}

                    <div className="mt-3 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-xs leading-relaxed text-zinc-600">
                      {!b.usesPoolSeeding ? (
                        <p>
                          <span className="font-medium text-zinc-800">Direct-seeded bracket.</span> Drag
                          Round 1 teams on the{" "}
                          <Link
                            href="/admin/structure?builder=1"
                            className="font-medium text-emerald-800 underline"
                          >
                            Structure seed board
                          </Link>
                          , or edit under Games. Apply standings is only for pool-seeded brackets.
                        </p>
                      ) : b.needsResolutionRefresh ? (
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
                        disabled={resolvePending || !canApplyStandings}
                        title={
                          !b.usesPoolSeeding
                            ? "This bracket was seeded with teams at create"
                            : !rrComplete
                              ? "Finish all pool games (final or cancelled) first"
                              : "Fill first-round teams from current pool standings"
                        }
                        className={canApplyStandings ? btnPrimary : btnSecondary}
                      >
                        {resolvePending
                          ? "Applying…"
                          : b.needsResolutionRefresh
                            ? "Re-apply standings to seeds"
                            : "Apply standings to seeds"}
                      </button>
                    </form>
                    {canConfigure ? (
                      <Link href="/admin/structure?builder=1" className={btnSecondary}>
                        Edit Round 1 seeds
                      </Link>
                    ) : null}
                    <ConfirmForm
                      action={resetAction}
                      message={`Reset “${b.name}” for ${b.division.name}? This keeps the bracket but clears teams, scores, and sets bracket game statuses to SCHEDULED.`}
                      className="inline"
                    >
                      <input type="hidden" name="bracketId" value={b.id} />
                      <button type="submit" disabled={resetPending || !canReset} className={btnSecondary}>
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

      {canConfigure && feederBrackets.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-zinc-900">Custom feeder map (Phase D)</h2>
          <p className="text-xs text-zinc-600">
            Edit cross-bracket drops and seat feeders for poster-style (9/27-team) maps. Classic
            brackets already have auto-wired paths at create time.
          </p>
          {feederBrackets.map((fb) => (
            <BracketFeederEditor
              key={fb.bracketId}
              bracketName={fb.bracketName}
              matches={fb.matches}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}
