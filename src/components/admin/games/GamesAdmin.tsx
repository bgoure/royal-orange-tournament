"use client";

import {
  useActionState,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { GameKind, GameResultType, GameStatus } from "@prisma/client";
import { publicGameStatusLabel } from "@/components/schedule/GameList";
import type { Division, Field, Game, Pool, Team } from "@prisma/client";
import { formatFieldWithLocation } from "@/lib/field-display";
import {
  createGame,
  deleteGame,
  generatePoolRoundRobin,
  updateBracketGameSchedule,
  updateBracketGameTeams,
  updateGameMeta,
  updateGameScoring,
  type GameActionResult,
} from "@/app/admin/_actions/games";
import { ActionMessage } from "@/components/admin/structure/ActionMessage";
import { ConfirmForm } from "@/components/admin/structure/ConfirmForm";
import { ScorekeeperView } from "@/components/admin/games/ScorekeeperView";
import { formatJsDateAsDatetimeLocalInZone } from "@/lib/datetime-tournament";

export type AdminGameRow = Game & {
  homeTeam: Team | null;
  awayTeam: Team | null;
  field: Field & { location: { name: string } };
  pool: (Pool & { division: Division }) | null;
  bracket: { id: string; divisionId?: string; division?: { id: string; name: string } | null } | null;
  division: { id: string; name: string } | null;
  consolationHomePool: { id: string; name: string } | null;
  consolationAwayPool: { id: string; name: string } | null;
};

export type PoolWithTeams = {
  poolId: string;
  label: string;
  divisionId: string;
  teams: { id: string; name: string }[];
};

export type AdminDivisionTab = { id: string; name: string };

export function gameDivisionId(g: AdminGameRow): string | null {
  return (
    g.pool?.division?.id ??
    g.division?.id ??
    g.bracket?.divisionId ??
    g.bracket?.division?.id ??
    null
  );
}

const formClass =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20";
const labelClass = "text-[10px] font-semibold uppercase tracking-wide text-zinc-500";
const btnPrimary =
  "rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50";
const btnSecondary =
  "rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50";
const btnDanger =
  "rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-50";

function fmtWhen(iso: string, timeZone: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export type AdminFieldOption = { id: string; label: string };

type Props = {
  games: AdminGameRow[];
  fields: AdminFieldOption[];
  poolsWithTeams: PoolWithTeams[];
  divisions: AdminDivisionTab[];
  /** From `?division=` — sticky across refresh. */
  initialDivisionId?: string;
  tournamentName: string;
  /** IANA zone for interpreting `datetime-local` values (matches tournament settings). */
  tournamentTimezone: string;
  isAdmin: boolean;
  /** Day-of mobile scoring UI when `scorekeeper`. */
  mode?: "admin" | "scorekeeper";
  /** Existing field double-books (non-placeholder games). */
  fieldConflicts?: Array<{
    fieldName: string;
    gameA: { id: string; gameNumber: string | null; scheduledAt: Date };
    gameB: { id: string; gameNumber: string | null; scheduledAt: Date };
  }>;
};

function gamesAdminHref(opts: { mode?: "admin" | "scorekeeper"; divisionId?: string }) {
  const params = new URLSearchParams();
  if (opts.mode === "scorekeeper") params.set("mode", "scorekeeper");
  if (opts.divisionId) params.set("division", opts.divisionId);
  const q = params.toString();
  return q ? `/admin/games?${q}` : "/admin/games";
}

export function GamesAdmin({
  games,
  fields,
  poolsWithTeams,
  divisions,
  initialDivisionId,
  tournamentName,
  tournamentTimezone,
  isAdmin,
  mode = "admin",
  fieldConflicts = [],
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [createState, createAction, createPending] = useActionState(createGame, undefined as GameActionResult | undefined);
  const [rrState, rrAction, rrPending] = useActionState(
    generatePoolRoundRobin,
    undefined as GameActionResult | undefined,
  );
  const [divisionId, setDivisionIdState] = useState(() => {
    if (initialDivisionId && divisions.some((d) => d.id === initialDivisionId)) {
      return initialDivisionId;
    }
    return divisions[0]?.id ?? "";
  });
  const activeDivisionId = useMemo(() => {
    if (divisionId && divisions.some((d) => d.id === divisionId)) return divisionId;
    return divisions[0]?.id ?? "";
  }, [divisionId, divisions]);

  // Stay in sync when the server passes a new `?division=` after navigation/refresh.
  useEffect(() => {
    if (initialDivisionId && divisions.some((d) => d.id === initialDivisionId)) {
      setDivisionIdState(initialDivisionId);
    }
  }, [initialDivisionId, divisions]);

  function setDivisionId(nextId: string) {
    setDivisionIdState(nextId);
    const params = new URLSearchParams();
    if (mode === "scorekeeper") params.set("mode", "scorekeeper");
    if (nextId) params.set("division", nextId);
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }

  const divisionPools = useMemo(
    () =>
      activeDivisionId
        ? poolsWithTeams.filter((p) => p.divisionId === activeDivisionId)
        : poolsWithTeams,
    [poolsWithTeams, activeDivisionId],
  );

  const divisionGames = useMemo(() => {
    if (!activeDivisionId) return games;
    return games.filter((g) => gameDivisionId(g) === activeDivisionId);
  }, [games, activeDivisionId]);

  const [poolId, setPoolId] = useState(divisionPools[0]?.poolId ?? "");
  const [rrPoolId, setRrPoolId] = useState(divisionPools[0]?.poolId ?? "");
  const [listFilter, setListFilter] = useState<"all" | "needs_score" | "unscheduled" | "live" | "final">(
    "all",
  );
  const [fieldFilter, setFieldFilter] = useState<string>("all");

  // Keep pool pickers on a pool in the active division when the tab changes.
  useEffect(() => {
    if (divisionPools.length === 0) {
      setPoolId("");
      setRrPoolId("");
      return;
    }
    if (!divisionPools.some((p) => p.poolId === poolId)) {
      setPoolId(divisionPools[0]!.poolId);
    }
    if (!divisionPools.some((p) => p.poolId === rrPoolId)) {
      setRrPoolId(divisionPools[0]!.poolId);
    }
  }, [divisionPools, poolId, rrPoolId]);

  const teamOptions = useMemo(() => {
    const p = divisionPools.find((x) => x.poolId === poolId);
    return p?.teams ?? [];
  }, [divisionPools, poolId]);

  const rrTeamCount = useMemo(() => {
    return divisionPools.find((x) => x.poolId === rrPoolId)?.teams.length ?? 0;
  }, [divisionPools, rrPoolId]);

  const filterCounts = useMemo(() => {
    const now = Date.now();
    let needs_score = 0;
    let unscheduled = 0;
    let live = 0;
    let final = 0;
    for (const g of divisionGames) {
      if (gameNeedsScore(g, now)) needs_score += 1;
      if (g.schedulePlaceholder) unscheduled += 1;
      if (g.status === GameStatus.LIVE) live += 1;
      if (g.status === GameStatus.FINAL) final += 1;
    }
    return { all: divisionGames.length, needs_score, unscheduled, live, final };
  }, [divisionGames]);

  const [createModal, setCreateModal] = useState<"roundRobin" | "newGame" | null>(null);

  useEffect(() => {
    if (rrState?.ok) setCreateModal(null);
  }, [rrState]);

  useEffect(() => {
    if (createState?.ok) setCreateModal(null);
  }, [createState]);

  const filteredGames = useMemo(() => {
    const now = Date.now();
    const list = divisionGames.filter((g) => {
      if (fieldFilter !== "all" && g.fieldId !== fieldFilter) return false;
      switch (listFilter) {
        case "needs_score":
          return gameNeedsScore(g, now);
        case "unscheduled":
          return g.schedulePlaceholder;
        case "live":
          return g.status === GameStatus.LIVE;
        case "final":
          return g.status === GameStatus.FINAL;
        default:
          return true;
      }
    });
    return sortGamesByGameNumber(list);
  }, [divisionGames, listFilter, fieldFilter]);

  if (mode === "scorekeeper") {
    return (
      <ScorekeeperView
        games={games}
        fields={fields}
        divisions={divisions}
        initialDivisionId={activeDivisionId}
        tournamentName={tournamentName}
        tournamentTimezone={tournamentTimezone}
        onDivisionChange={setDivisionId}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-10">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-4 sm:gap-4 sm:pb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Tournament</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Games</h1>
        <p className="mt-1 text-sm text-zinc-600">{tournamentName}</p>
        <p className="mt-1 text-xs text-zinc-500">
          Game start times use the tournament timezone: <span className="font-mono">{tournamentTimezone}</span>
        </p>
      </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={gamesAdminHref({ mode: "scorekeeper", divisionId: activeDivisionId || undefined })}
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Scorekeeper mode
          </Link>
          <Link href="/admin/divisions" className={`${btnSecondary} px-3 py-2 text-sm`}>
            Divisions &amp; pools
          </Link>
          <Link href="/admin/fields" className={`${btnSecondary} px-3 py-2 text-sm`}>
            Fields
          </Link>
          <Link href="/admin/teams" className={`${btnSecondary} px-3 py-2 text-sm`}>
            Teams
          </Link>
        </div>
      </header>

      {divisions.length > 1 ? (
        <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-2" role="tablist" aria-label="Division">
          {divisions.map((d) => {
            const selected = activeDivisionId === d.id;
            const count = games.filter((g) => gameDivisionId(g) === d.id).length;
            return (
              <button
                key={d.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  setDivisionId(d.id);
                  setListFilter("all");
                }}
                className={
                  selected
                    ? "rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white"
                    : "rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200"
                }
              >
                {d.name}
                <span className={`ml-1.5 tabular-nums ${selected ? "opacity-80" : "text-zinc-500"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {fieldConflicts.length > 0 ? (
        <div
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <p className="font-semibold">
            {fieldConflicts.length} field schedule conflict{fieldConflicts.length === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-xs text-amber-900/90">
            Two games occupy the same field within ~90 minutes. Fix field or start time below — new saves that
            collide are blocked.
          </p>
          <ul className="mt-2 list-inside list-disc text-xs">
            {fieldConflicts.slice(0, 8).map((c, i) => (
              <li key={`${c.gameA.id}-${c.gameB.id}-${i}`}>
                {c.fieldName}:{" "}
                {c.gameA.gameNumber ? `Game #${c.gameA.gameNumber}` : c.gameA.id.slice(0, 8)} vs{" "}
                {c.gameB.gameNumber ? `Game #${c.gameB.gameNumber}` : c.gameB.id.slice(0, 8)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCreateModal("roundRobin")}
          className={`${btnSecondary} px-3 py-2 text-sm`}
        >
          Generate round-robin
        </button>
        <button
          type="button"
          onClick={() => setCreateModal("newGame")}
          className={`${btnPrimary} px-3 py-2 text-sm`}
        >
          New pool game
        </button>
      </div>

      {createModal === "roundRobin" ? (
        <GamesAdminModal
          title="Generate pool round-robin"
          description="Create every pool-play matchup for one pool. Games rotate across fields; overflow waves are spaced by the slot length so a field is never double-booked. Odd team counts skip the bye slot."
          onClose={() => setCreateModal(null)}
        >
          <ActionMessage state={rrState} />
          {divisionPools.length === 0 ? (
            <p className="mt-4 text-sm text-amber-800">
              {poolsWithTeams.length === 0 ? (
                <>
                  Add pools and teams under{" "}
                  <Link href="/admin/divisions" className="font-medium underline">
                    Divisions
                  </Link>{" "}
                  first.
                </>
              ) : (
                <>No pools in this division. Switch tabs or add a pool under Divisions.</>
              )}
            </p>
          ) : fields.length === 0 ? (
            <p className="mt-4 text-sm text-amber-800">
              Add fields under{" "}
              <Link href="/admin/fields" className="font-medium underline">
                Fields
              </Link>{" "}
              before generating a schedule.
            </p>
          ) : (
            <form action={rrAction} className="mt-4 flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="rr-pool" className={labelClass}>
                    Pool
                  </label>
                  <select
                    id="rr-pool"
                    name="poolId"
                    required
                    value={rrPoolId}
                    onChange={(e) => setRrPoolId(e.target.value)}
                    className={`${formClass} mt-1 w-full`}
                  >
                    {divisionPools.map((p) => (
                      <option key={p.poolId} value={p.poolId}>
                        {p.label} ({p.teams.length} teams)
                      </option>
                    ))}
                  </select>
                  {rrTeamCount > 0 && rrTeamCount < 2 ? (
                    <p className="mt-1 text-[10px] text-amber-700">Need at least 2 teams in this pool.</p>
                  ) : rrTeamCount >= 2 ? (
                    <p className="mt-1 text-[10px] text-zinc-500">
                      Will create {(rrTeamCount * (rrTeamCount - 1)) / 2} games.
                    </p>
                  ) : null}
                </div>
                <div>
                  <label htmlFor="rr-when" className={labelClass}>
                    First round start ({tournamentTimezone})
                  </label>
                  <input
                    id="rr-when"
                    name="scheduledAt"
                    type="datetime-local"
                    required
                    className={`${formClass} mt-1 w-full`}
                  />
                </div>
                <div>
                  <label htmlFor="rr-slot" className={labelClass}>
                    Minutes between rounds
                  </label>
                  <input
                    id="rr-slot"
                    name="slotMinutes"
                    type="number"
                    min={15}
                    max={1440}
                    defaultValue={90}
                    required
                    className={`${formClass} mt-1 w-full`}
                  />
                </div>
                <div className="sm:col-span-2">
                  <span className={labelClass}>Fields (select one or more)</span>
                  <div className="mt-1 flex flex-wrap gap-3">
                    {fields.map((f) => (
                      <label key={f.id} className="inline-flex items-center gap-2 text-sm text-zinc-800">
                        <input type="checkbox" name="fieldIds" value={f.id} defaultChecked={fields[0]?.id === f.id} />
                        {f.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="inline-flex items-center gap-2 text-sm text-zinc-800">
                    <input type="checkbox" name="replaceExisting" value="true" />
                    Replace existing pool games for this pool
                  </label>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-100 pt-4">
                <button type="button" onClick={() => setCreateModal(null)} className={btnSecondary}>
                  Cancel
                </button>
                <button type="submit" disabled={rrPending || rrTeamCount < 2} className={btnPrimary}>
                  {rrPending ? "Generating…" : "Generate schedule"}
                </button>
              </div>
            </form>
          )}
        </GamesAdminModal>
      ) : null}

      {createModal === "newGame" ? (
        <GamesAdminModal
          title="New pool game"
          description="Pick two opponents from a pool in this division. Which side is recorded as home is set when you enter scores, not here."
          onClose={() => setCreateModal(null)}
        >
          <ActionMessage state={createState} />
          {divisionPools.length === 0 ? (
            <p className="mt-4 text-sm text-amber-800">
              {poolsWithTeams.length === 0 ? (
                <>
                  Add pools and teams under{" "}
                  <Link href="/admin/divisions" className="font-medium underline">
                    Divisions
                  </Link>{" "}
                  first.
                </>
              ) : (
                <>No pools in this division. Switch tabs or add a pool under Divisions.</>
              )}
            </p>
          ) : fields.length === 0 ? (
            <p className="mt-4 text-sm text-amber-800">
              Add fields under{" "}
              <Link href="/admin/fields" className="font-medium underline">
                Fields
              </Link>{" "}
              (linked to a location) before scheduling games.
            </p>
          ) : (
            <form action={createAction} className="mt-4 flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="cg-pool" className={labelClass}>
                    Pool
                  </label>
                  <select
                    id="cg-pool"
                    name="poolId"
                    required
                    value={poolId}
                    onChange={(e) => setPoolId(e.target.value)}
                    className={`${formClass} mt-1 w-full`}
                  >
                    {divisionPools.map((p) => (
                      <option key={p.poolId} value={p.poolId}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="cg-field" className={labelClass}>
                    Field
                  </label>
                  <select id="cg-field" name="fieldId" required className={`${formClass} mt-1 w-full`}>
                    <option value="">Select a field…</option>
                    {fields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="cg-when" className={labelClass}>
                    Start ({tournamentTimezone})
                  </label>
                  <input
                    id="cg-when"
                    name="scheduledAt"
                    type="datetime-local"
                    required
                    className={`${formClass} mt-1 w-full`}
                  />
                </div>
                <div>
                  <label htmlFor="cg-game-num" className={labelClass}>
                    Game ID / # (optional)
                  </label>
                  <input
                    id="cg-game-num"
                    name="gameNumber"
                    type="text"
                    maxLength={64}
                    placeholder="e.g. 12 or Field 3"
                    className={`${formClass} mt-1 w-full`}
                  />
                </div>
                <div>
                  <label htmlFor="cg-away" className={labelClass}>
                    Opponent 1
                  </label>
                  <select id="cg-away" name="awayTeamId" required className={`${formClass} mt-1 w-full`}>
                    <option value="">Select…</option>
                    {teamOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-0.5 text-[10px] text-zinc-500">Stored as away slot until scoring sets field home.</p>
                </div>
                <div>
                  <label htmlFor="cg-home" className={labelClass}>
                    Opponent 2
                  </label>
                  <select id="cg-home" name="homeTeamId" required className={`${formClass} mt-1 w-full`}>
                    <option value="">Select…</option>
                    {teamOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-0.5 text-[10px] text-zinc-500">Stored as home slot until scoring sets field home.</p>
                </div>
                <div>
                  <label htmlFor="cg-status" className={labelClass}>
                    Status
                  </label>
                  <select id="cg-status" name="status" className={`${formClass} mt-1 w-full`} defaultValue="SCHEDULED">
                    {GAME_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {publicGameStatusLabel(s)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-100 pt-4">
                <button type="button" onClick={() => setCreateModal(null)} className={btnSecondary}>
                  Cancel
                </button>
                <button type="submit" disabled={createPending} className={btnPrimary}>
                  {createPending ? "Creating…" : "Create game"}
                </button>
              </div>
            </form>
          )}
        </GamesAdminModal>
      ) : null}

      {divisionGames.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {games.length === 0
            ? "No games scheduled yet."
            : "No games in this division yet. Switch tabs or create a game."}
        </p>
      ) : (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 border-b border-zinc-200 pb-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">Game list</h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Showing {filteredGames.length} of {divisionGames.length}
                  {listFilter !== "all" || fieldFilter !== "all" ? " (filtered)" : ""}, ordered by Game
                  ID. Expand a game for locked details; Edit opens a modal.
                </p>
              </div>
              <label className="flex min-w-[12rem] flex-col gap-1">
                <span className={labelClass}>Field</span>
                <select
                  value={fieldFilter}
                  onChange={(e) => setFieldFilter(e.target.value)}
                  className={`${formClass} w-full`}
                >
                  <option value="all">All fields</option>
                  {fields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter games">
              {(
                [
                  ["all", "All"],
                  ["needs_score", "Needs score"],
                  ["unscheduled", "Unscheduled"],
                  ["live", "Live"],
                  ["final", "Final"],
                ] as const
              ).map(([id, label]) => {
                const count = filterCounts[id];
                const active = listFilter === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setListFilter(id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? id === "live"
                          ? "border-red-600 bg-red-600 text-white"
                          : id === "final"
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : id === "needs_score" || id === "unscheduled"
                              ? "border-amber-600 bg-amber-600 text-white"
                              : "border-zinc-800 bg-zinc-800 text-white"
                        : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    {label}
                    <span
                      className={`tabular-nums ${active ? "opacity-90" : "text-zinc-500"}`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {filteredGames.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-600">
              No games match this filter.{" "}
              <button
                type="button"
                className="font-semibold text-emerald-800 underline"
                onClick={() => {
                  setListFilter("all");
                  setFieldFilter("all");
                }}
              >
                Clear filters
              </button>
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  fields={fields}
                  poolsWithTeams={divisionPools}
                  tournamentTimezone={tournamentTimezone}
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function gameNeedsScore(game: AdminGameRow, now: number): boolean {
  if (game.status === GameStatus.LIVE || game.status === GameStatus.AWAITING_RESULTS) return true;
  if (
    game.status === GameStatus.FINAL ||
    game.status === GameStatus.CANCELLED ||
    game.status === GameStatus.POSTPONED
  ) {
    return false;
  }
  if (game.schedulePlaceholder) return false;
  const start = new Date(game.scheduledAt).getTime();
  return start <= now && (game.homeRuns == null || game.awayRuns == null);
}

/** Numbered games first (numeric / natural order), then unnumbered by start time. */
function sortGamesByGameNumber<T extends { gameNumber: string | null; scheduledAt: Date | string }>(
  games: T[],
): T[] {
  return [...games].sort((a, b) => {
    const na = a.gameNumber?.trim() ?? "";
    const nb = b.gameNumber?.trim() ?? "";
    const aHas = na.length > 0;
    const bHas = nb.length > 0;
    if (aHas && bHas) {
      const aAllDigits = /^\d+$/.test(na);
      const bAllDigits = /^\d+$/.test(nb);
      const c =
        aAllDigits && bAllDigits
          ? Number(na) - Number(nb)
          : na.localeCompare(nb, undefined, { numeric: true, sensitivity: "base" });
      if (c !== 0) return c;
    } else if (aHas && !bHas) return -1;
    else if (!aHas && bHas) return 1;
    const ta = typeof a.scheduledAt === "string" ? new Date(a.scheduledAt).getTime() : a.scheduledAt.getTime();
    const tb = typeof b.scheduledAt === "string" ? new Date(b.scheduledAt).getTime() : b.scheduledAt.getTime();
    return ta - tb;
  });
}

function GamesAdminModal({
  title,
  description,
  onClose,
  children,
  size = "md",
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
  size?: "md" | "lg";
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close dialog" onClick={onClose} />
      <div
        className={`relative z-10 flex w-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl ${
          size === "lg"
            ? "max-h-[min(92vh,56rem)] max-w-3xl"
            : "max-h-[min(90vh,44rem)] max-w-2xl"
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-zinc-900">
              {title}
            </h2>
            <p className="mt-1 text-xs text-zinc-600">{description}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
          >
            Close
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function LockedField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className={labelClass}>{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-zinc-900">{value ?? "—"}</dd>
    </div>
  );
}

function adminStatusBadgeClass(status: GameStatus): string {
  switch (status) {
    case GameStatus.LIVE:
      return "bg-red-100 text-red-800 ring-1 ring-red-200";
    case GameStatus.FINAL:
      return "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200";
    case GameStatus.AWAITING_RESULTS:
      return "bg-amber-100 text-amber-950 ring-1 ring-amber-200";
    case GameStatus.POSTPONED:
      return "bg-orange-100 text-orange-950 ring-1 ring-orange-200";
    case GameStatus.CANCELLED:
      return "bg-zinc-200 text-zinc-600 ring-1 ring-zinc-300";
    default:
      return "bg-sky-100 text-sky-950 ring-1 ring-sky-200";
  }
}

function gameCardAccentClass(game: AdminGameRow): string {
  if (game.status === GameStatus.LIVE) return "border-red-300 shadow-red-100/80";
  if (game.status === GameStatus.FINAL) return "border-emerald-200";
  if (game.schedulePlaceholder) return "border-amber-300";
  if (game.status === GameStatus.AWAITING_RESULTS) return "border-amber-300";
  return "border-zinc-200";
}

const GAME_STATUS_OPTIONS: GameStatus[] = [
  GameStatus.SCHEDULED,
  GameStatus.LIVE,
  GameStatus.AWAITING_RESULTS,
  GameStatus.FINAL,
  GameStatus.POSTPONED,
  GameStatus.CANCELLED,
];

const RESULT_OPTIONS: GameResultType[] = [
  GameResultType.REGULAR,
  GameResultType.FORFEIT_HOME_WINS,
  GameResultType.FORFEIT_AWAY_WINS,
];

function GameCard({
  game,
  fields,
  poolsWithTeams,
  tournamentTimezone,
  isAdmin,
}: {
  game: AdminGameRow;
  fields: AdminFieldOption[];
  poolsWithTeams: PoolWithTeams[];
  tournamentTimezone: string;
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [scoreState, scoreAction, scorePending] = useActionState(
    updateGameScoring,
    undefined as GameActionResult | undefined,
  );
  const [metaState, metaAction, metaPending] = useActionState(
    updateGameMeta,
    undefined as GameActionResult | undefined,
  );
  const [bracketScheduleState, bracketScheduleAction, bracketSchedulePending] = useActionState(
    updateBracketGameSchedule,
    undefined as GameActionResult | undefined,
  );
  const [bracketTeamsState, bracketTeamsAction, bracketTeamsPending] = useActionState(
    updateBracketGameTeams,
    undefined as GameActionResult | undefined,
  );
  const [delState, delAction, delPending] = useActionState(deleteGame, undefined as GameActionResult | undefined);

  const [metaPoolId, setMetaPoolId] = useState(game.poolId ?? poolsWithTeams[0]?.poolId ?? "");
  const metaTeams = useMemo(() => {
    const p = poolsWithTeams.find((x) => x.poolId === metaPoolId);
    return p?.teams ?? [];
  }, [poolsWithTeams, metaPoolId]);

  const allTeamsFlat = useMemo(() => {
    const out: { id: string; label: string }[] = [];
    for (const p of poolsWithTeams) {
      for (const t of p.teams) {
        out.push({ id: t.id, label: `${p.label} · ${t.name}` });
      }
    }
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }, [poolsWithTeams]);

  useEffect(() => {
    if (
      scoreState?.ok ||
      metaState?.ok ||
      bracketScheduleState?.ok ||
      bracketTeamsState?.ok ||
      delState?.ok
    ) {
      setEditing(false);
    }
  }, [scoreState, metaState, bracketScheduleState, bracketTeamsState, delState]);

  const awayLabel = game.awayTeam ? game.awayTeam.name : "TBD";
  const homeLabel = game.homeTeam ? game.homeTeam.name : "TBD";
  const iso = typeof game.scheduledAt === "string" ? game.scheduledAt : new Date(game.scheduledAt).toISOString();
  const isPoolGame = game.gameKind === GameKind.POOL;
  const hasScore = game.homeRuns != null && game.awayRuns != null;
  const scoreLine = hasScore ? `${game.awayRuns}–${game.homeRuns}` : "—";
  const contextLine = game.pool
    ? `${game.pool.division.name} — ${game.pool.name}`
    : game.gameKind === GameKind.CONSOLATION && game.division
      ? `${game.division.name} · Consolation`
      : "Bracket";
  const whenLabel = game.schedulePlaceholder ? "Time TBD" : fmtWhen(iso, tournamentTimezone);
  const fieldLabel = formatFieldWithLocation(game.field.name, game.field.location.name);

  function openEdit(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    setEditing(true);
  }

  return (
    <>
      <details
        className={`group overflow-hidden rounded-xl border bg-white shadow-sm ${gameCardAccentClass(game)}`}
      >
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
          <span
            aria-hidden
            className="inline-flex size-5 shrink-0 items-center justify-center rounded border border-zinc-200 bg-zinc-50 text-zinc-500 transition group-open:rotate-90"
          >
            ▸
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              {game.gameNumber ? (
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {game.gameNumber}
                </span>
              ) : null}
              <p className="text-sm font-semibold text-zinc-900">
                {awayLabel} <span className="font-normal text-zinc-400">vs</span> {homeLabel}
              </p>
              {hasScore ? (
                <span className="tabular-nums text-sm font-semibold text-zinc-700">{scoreLine}</span>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-zinc-600">
              <span className={game.schedulePlaceholder ? "font-semibold text-amber-800" : ""}>
                {whenLabel}
              </span>
              {" · "}
              {fieldLabel}
              {" · "}
              {contextLine}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${adminStatusBadgeClass(game.status)}`}
            >
              {game.status === GameStatus.LIVE ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-red-600" />
                  </span>
                  {publicGameStatusLabel(game.status)}
                </span>
              ) : (
                publicGameStatusLabel(game.status)
              )}
            </span>
            <button type="button" onClick={openEdit} className={`${btnSecondary} px-3 py-1.5 text-sm`}>
              Edit
            </button>
          </div>
        </summary>

        <div className="border-t border-zinc-100 bg-zinc-50/60 px-4 py-3">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <LockedField label="Game ID / #" value={game.gameNumber || "—"} />
            <LockedField label="When" value={whenLabel} />
            <LockedField label="Field" value={fieldLabel} />
            <LockedField label="Context" value={contextLine} />
            <LockedField label="Away" value={awayLabel} />
            <LockedField label="Home" value={homeLabel} />
            <LockedField label={`Runs — ${awayLabel} (A)`} value={game.awayRuns ?? "—"} />
            <LockedField label={`Runs — ${homeLabel} (H)`} value={game.homeRuns ?? "—"} />
            {isPoolGame ? (
              <>
                <LockedField
                  label={`Def. IP — ${awayLabel} (A)`}
                  value={game.awayDefensiveInnings ?? "—"}
                />
                <LockedField
                  label={`Def. IP — ${homeLabel} (H)`}
                  value={game.homeDefensiveInnings ?? "—"}
                />
              </>
            ) : null}
            <LockedField label={`Off. IP — ${awayLabel} (A)`} value={game.awayOffensiveInnings ?? "—"} />
            <LockedField label={`Off. IP — ${homeLabel} (H)`} value={game.homeOffensiveInnings ?? "—"} />
            <LockedField label="Status" value={publicGameStatusLabel(game.status)} />
            <LockedField label="Result" value={game.resultType.replace(/_/g, " ")} />
          </dl>
          <p className="mt-3 text-xs text-zinc-500">Fields are locked here. Use Edit to change this game.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setEditing(true)} className={btnPrimary}>
              Edit game
            </button>
          </div>
        </div>
      </details>

      {editing ? (
        <GamesAdminModal
          size="lg"
          title={
            game.gameNumber
              ? `Edit ${game.gameNumber}`
              : `Edit ${awayLabel} vs ${homeLabel}`
          }
          description="Update scoring, schedule, field, and teams for this game. Saves refresh the list."
          onClose={() => setEditing(false)}
        >
          <ActionMessage state={delState} />
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Scoring &amp; innings
              </h3>
              <p className="mt-1 text-[11px] text-zinc-500">
                {isPoolGame
                  ? "Pool: runs and defensive IP for each side; offensive IP defaults from opponent defensive when left blank. Final games need both runs and both defensive innings."
                  : "Playoff / consolation: runs (and optional offensive IP); defensive IP not required for standings."}
              </p>
              <ActionMessage state={scoreState} />
              <form action={scoreAction} className="mt-3">
                <input type="hidden" name="id" value={game.id} />
                <input type="hidden" name="gameKind" value={game.gameKind} />
                {game.homeTeamId && game.awayTeamId ? (
                  <fieldset className="mb-3 rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2">
                    <legend className="px-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      Field home (record)
                    </legend>
                    <p className="mb-2 text-[11px] leading-snug text-zinc-500">
                      {isPoolGame
                        ? "Which team is recorded as home. Swapping updates home/away columns and paired stats."
                        : "Bracket games start as a coin flip. Set field home when the game is underway — swapping updates home/away columns and paired stats."}
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
                        <input
                          type="radio"
                          name="fieldHomeTeamId"
                          value={game.awayTeamId}
                          className="size-4 border-zinc-300 text-emerald-600 focus:ring-emerald-500/30"
                        />
                        <span>
                          <span className="font-medium">{awayLabel}</span>
                          <span className="ml-1 text-xs text-zinc-400">(A)</span>
                        </span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
                        <input
                          type="radio"
                          name="fieldHomeTeamId"
                          value={game.homeTeamId}
                          defaultChecked
                          className="size-4 border-zinc-300 text-emerald-600 focus:ring-emerald-500/30"
                        />
                        <span>
                          <span className="font-medium">{homeLabel}</span>
                          <span className="ml-1 text-xs text-zinc-400">(H)</span>
                        </span>
                      </label>
                    </div>
                  </fieldset>
                ) : (
                  <input type="hidden" name="fieldHomeTeamId" value="" />
                )}
                {!isPoolGame ? (
                  <>
                    <input type="hidden" name="homeDefensiveInnings" value={game.homeDefensiveInnings ?? ""} />
                    <input type="hidden" name="awayDefensiveInnings" value={game.awayDefensiveInnings ?? ""} />
                  </>
                ) : null}
                <div className="flex flex-wrap items-end gap-3">
                  <div className={`grid grid-cols-2 gap-3 ${isPoolGame ? "sm:grid-cols-4" : "sm:grid-cols-2"}`}>
                    <div>
                      <span className={labelClass}>
                        Runs — {awayLabel} <span className="font-normal text-zinc-400">(A)</span>
                      </span>
                      <input
                        name="awayRuns"
                        type="number"
                        min={0}
                        defaultValue={game.awayRuns ?? ""}
                        className={`${formClass} mt-1 w-20`}
                      />
                    </div>
                    {isPoolGame ? (
                      <div>
                        <span className={labelClass}>
                          Def. IP — {awayLabel} <span className="font-normal text-zinc-400">(A)</span>
                        </span>
                        <input
                          name="awayDefensiveInnings"
                          type="number"
                          step={0.1}
                          min={0}
                          defaultValue={game.awayDefensiveInnings ?? ""}
                          className={`${formClass} mt-1 w-24`}
                        />
                      </div>
                    ) : null}
                    <div>
                      <span className={labelClass}>
                        Runs — {homeLabel} <span className="font-normal text-zinc-400">(H)</span>
                      </span>
                      <input
                        name="homeRuns"
                        type="number"
                        min={0}
                        defaultValue={game.homeRuns ?? ""}
                        className={`${formClass} mt-1 w-20`}
                      />
                    </div>
                    {isPoolGame ? (
                      <div>
                        <span className={labelClass}>
                          Def. IP — {homeLabel} <span className="font-normal text-zinc-400">(H)</span>
                        </span>
                        <input
                          name="homeDefensiveInnings"
                          type="number"
                          step={0.1}
                          min={0}
                          defaultValue={game.homeDefensiveInnings ?? ""}
                          className={`${formClass} mt-1 w-24`}
                        />
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <span className={labelClass}>Off. IP (opt)</span>
                    <div className="mt-1 flex gap-2">
                      <input
                        name="awayOffensiveInnings"
                        type="number"
                        step={0.1}
                        min={0}
                        placeholder={`${awayLabel} (A)`}
                        defaultValue={game.awayOffensiveInnings ?? ""}
                        className={`${formClass} w-20`}
                      />
                      <input
                        name="homeOffensiveInnings"
                        type="number"
                        step={0.1}
                        min={0}
                        placeholder={`${homeLabel} (H)`}
                        defaultValue={game.homeOffensiveInnings ?? ""}
                        className={`${formClass} w-20`}
                      />
                    </div>
                  </div>
                  <div>
                    <span className={labelClass}>Status</span>
                    <select name="status" defaultValue={game.status} className={`${formClass} mt-1 w-36`}>
                      {GAME_STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {publicGameStatusLabel(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className={labelClass}>Result</span>
                    <select
                      name="resultType"
                      defaultValue={game.resultType}
                      className={`${formClass} mt-1 min-w-[10rem]`}
                    >
                      {RESULT_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" disabled={scorePending} className={btnPrimary}>
                    {scorePending ? "Saving…" : "Save scores"}
                  </button>
                </div>
              </form>
            </div>

            {game.poolId ? (
              <div className="border-t border-zinc-100 pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Schedule &amp; matchup
                </h3>
                <ActionMessage state={metaState} />
                <form action={metaAction} className="mt-3 flex flex-col gap-3">
                  <input type="hidden" name="id" value={game.id} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>Pool</label>
                      <select
                        name="poolId"
                        required
                        value={metaPoolId}
                        onChange={(e) => setMetaPoolId(e.target.value)}
                        className={`${formClass} mt-1 w-full`}
                      >
                        {poolsWithTeams.map((p) => (
                          <option key={p.poolId} value={p.poolId}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Field</label>
                      <select
                        name="fieldId"
                        required
                        defaultValue={game.fieldId}
                        className={`${formClass} mt-1 w-full`}
                      >
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
                        defaultValue={formatJsDateAsDatetimeLocalInZone(new Date(iso), tournamentTimezone)}
                        className={`${formClass} mt-1 w-full`}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Away</label>
                      <select
                        name="awayTeamId"
                        required
                        defaultValue={game.awayTeamId ?? ""}
                        className={`${formClass} mt-1 w-full`}
                      >
                        <option value="">Select…</option>
                        {metaTeams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Home</label>
                      <select
                        name="homeTeamId"
                        required
                        defaultValue={game.homeTeamId ?? ""}
                        className={`${formClass} mt-1 w-full`}
                      >
                        <option value="">Select…</option>
                        {metaTeams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Game ID / #</label>
                      <input
                        name="gameNumber"
                        type="text"
                        maxLength={64}
                        defaultValue={game.gameNumber ?? ""}
                        placeholder="Director label or bracket game #"
                        className={`${formClass} mt-1 w-full`}
                      />
                      <p className="mt-1 text-[10px] text-zinc-500">Clear the field and save to remove.</p>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={metaPending}
                    className={`${btnSecondary} w-fit px-3 py-2 text-sm`}
                  >
                    {metaPending ? "Saving…" : "Save schedule & teams"}
                  </button>
                </form>
              </div>
            ) : (
              <>
                <div className="border-t border-zinc-100 pt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Schedule &amp; location
                  </h3>
                  <p className="mt-1 text-xs text-zinc-600">
                    The wizard stores a placeholder time until you save a real slot here (clears the public
                    “TBD”).
                  </p>
                  <ActionMessage state={bracketScheduleState} />
                  <form
                    key={`bracket-sched-${game.id}-${game.schedulePlaceholder ? "tbd" : iso}-${game.fieldId}`}
                    action={bracketScheduleAction}
                    className="mt-3 flex flex-col gap-3"
                  >
                    <input type="hidden" name="id" value={game.id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className={labelClass}>Field</label>
                        <select
                          name="fieldId"
                          required
                          defaultValue={game.fieldId}
                          className={`${formClass} mt-1 w-full`}
                        >
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
                          defaultValue={
                            game.schedulePlaceholder
                              ? ""
                              : formatJsDateAsDatetimeLocalInZone(new Date(iso), tournamentTimezone)
                          }
                          className={`${formClass} mt-1 w-full`}
                        />
                        {game.schedulePlaceholder ? (
                          <p className="mt-1 text-[10px] text-amber-700">
                            Pick the real start time (wizard seed time is not used until you save).
                          </p>
                        ) : null}
                      </div>
                      <div>
                        <label className={labelClass}>Game ID / #</label>
                        <input
                          name="gameNumber"
                          type="text"
                          maxLength={64}
                          defaultValue={game.gameNumber ?? ""}
                          placeholder="Director label or bracket game #"
                          className={`${formClass} mt-1 w-full`}
                        />
                        <p className="mt-1 text-[10px] text-zinc-500">Clear the field and save to remove.</p>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={bracketSchedulePending}
                      className={`${btnSecondary} w-fit px-3 py-2 text-sm`}
                    >
                      {bracketSchedulePending ? "Saving…" : "Save schedule & location"}
                    </button>
                  </form>
                </div>
                <div className="border-t border-zinc-100 pt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Teams (override)
                  </h3>
                  <p className="mt-1 text-xs text-zinc-600">
                    Adjust matchups after standings seeding, or fix one-off swaps.
                  </p>
                  <ActionMessage state={bracketTeamsState} />
                  <form action={bracketTeamsAction} className="mt-3 flex flex-col gap-3">
                    <input type="hidden" name="id" value={game.id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className={labelClass}>Away</label>
                        <select
                          name="awayTeamId"
                          required
                          defaultValue={game.awayTeamId ?? ""}
                          className={`${formClass} mt-1 w-full`}
                        >
                          <option value="">Select…</option>
                          {allTeamsFlat.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Home</label>
                        <select
                          name="homeTeamId"
                          required
                          defaultValue={game.homeTeamId ?? ""}
                          className={`${formClass} mt-1 w-full`}
                        >
                          <option value="">Select…</option>
                          {allTeamsFlat.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={bracketTeamsPending}
                      className={`${btnSecondary} w-fit px-3 py-2 text-sm`}
                    >
                      {bracketTeamsPending ? "Saving…" : "Save teams"}
                    </button>
                  </form>
                </div>
              </>
            )}

            {isAdmin ? (
              <div className="border-t border-zinc-100 pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Danger zone</h3>
                <ConfirmForm
                  message={
                    game.poolId
                      ? "Delete this game? Standings will be recalculated for the pool."
                      : game.gameKind === GameKind.CONSOLATION
                        ? "Delete this consolation game? This cannot be undone."
                        : "Delete this bracket game? This cannot be undone."
                  }
                  action={delAction}
                  className="mt-3"
                >
                  <input type="hidden" name="id" value={game.id} />
                  <button type="submit" disabled={delPending} className={btnDanger}>
                    {delPending ? "Deleting…" : "Delete game"}
                  </button>
                </ConfirmForm>
              </div>
            ) : null}
          </div>
        </GamesAdminModal>
      ) : null}
    </>
  );
}
