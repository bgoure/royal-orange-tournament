"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
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
  bracket: { id: string } | null;
  division: { id: string; name: string } | null;
  consolationHomePool: { id: string; name: string } | null;
  consolationAwayPool: { id: string; name: string } | null;
};

export type PoolWithTeams = {
  poolId: string;
  label: string;
  teams: { id: string; name: string }[];
};

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

export function GamesAdmin({
  games,
  fields,
  poolsWithTeams,
  tournamentName,
  tournamentTimezone,
  isAdmin,
  mode = "admin",
  fieldConflicts = [],
}: Props) {
  const [createState, createAction, createPending] = useActionState(createGame, undefined as GameActionResult | undefined);
  const [rrState, rrAction, rrPending] = useActionState(
    generatePoolRoundRobin,
    undefined as GameActionResult | undefined,
  );
  const [poolId, setPoolId] = useState(poolsWithTeams[0]?.poolId ?? "");
  const [rrPoolId, setRrPoolId] = useState(poolsWithTeams[0]?.poolId ?? "");
  const [listFilter, setListFilter] = useState<"all" | "needs_score" | "unscheduled" | "live" | "final">(
    "all",
  );
  const [fieldFilter, setFieldFilter] = useState<string>("all");

  const teamOptions = useMemo(() => {
    const p = poolsWithTeams.find((x) => x.poolId === poolId);
    return p?.teams ?? [];
  }, [poolsWithTeams, poolId]);

  const rrTeamCount = useMemo(() => {
    return poolsWithTeams.find((x) => x.poolId === rrPoolId)?.teams.length ?? 0;
  }, [poolsWithTeams, rrPoolId]);

  const filterCounts = useMemo(() => {
    const now = Date.now();
    let needs_score = 0;
    let unscheduled = 0;
    let live = 0;
    let final = 0;
    for (const g of games) {
      if (gameNeedsScore(g, now)) needs_score += 1;
      if (g.schedulePlaceholder) unscheduled += 1;
      if (g.status === GameStatus.LIVE) live += 1;
      if (g.status === GameStatus.FINAL) final += 1;
    }
    return { all: games.length, needs_score, unscheduled, live, final };
  }, [games]);

  const filteredGames = useMemo(() => {
    const now = Date.now();
    return games.filter((g) => {
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
  }, [games, listFilter, fieldFilter]);

  if (mode === "scorekeeper") {
    return (
      <ScorekeeperView
        games={games}
        fields={fields}
        tournamentName={tournamentName}
        tournamentTimezone={tournamentTimezone}
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
            href="/admin/games?mode=scorekeeper"
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

      <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-zinc-900">Generate pool round-robin</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Create every pool-play matchup for one pool. Games rotate across fields; when a round has more games
          than fields, overflow waves are spaced by the slot length so a field is never double-booked. Odd team
          counts skip the bye slot (no bye games).
        </p>
        <ActionMessage state={rrState} />
        {poolsWithTeams.length === 0 ? (
          <p className="mt-4 text-sm text-amber-800">
            Add pools and teams under{" "}
            <Link href="/admin/divisions" className="font-medium underline">
              Divisions
            </Link>{" "}
            first.
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
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
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
                  {poolsWithTeams.map((p) => (
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
              <div className="lg:col-span-2 xl:col-span-3">
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
              <div className="lg:col-span-2 xl:col-span-3">
                <label className="inline-flex items-center gap-2 text-sm text-zinc-800">
                  <input type="checkbox" name="replaceExisting" value="true" />
                  Replace existing pool games for this pool
                </label>
              </div>
            </div>
            <button type="submit" disabled={rrPending || rrTeamCount < 2} className={`${btnPrimary} w-fit`}>
              {rrPending ? "Generating…" : "Generate schedule"}
            </button>
          </form>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-6">
        <h2 className="text-sm font-semibold text-zinc-900">New pool game</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Pool play games belong to a division pool. Pick two opponents from that pool (both required). Which side is
          recorded as home is set when you enter scores, not here.
        </p>
        <ActionMessage state={createState} />
        {poolsWithTeams.length === 0 ? (
          <p className="mt-4 text-sm text-amber-800">
            Add pools and teams under{" "}
            <Link href="/admin/divisions" className="font-medium underline">
              Divisions
            </Link>{" "}
            first.
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
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
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
                  {poolsWithTeams.map((p) => (
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
                <input id="cg-when" name="scheduledAt" type="datetime-local" required className={`${formClass} mt-1 w-full`} />
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
            </div>
            <button type="submit" disabled={createPending} className={`${btnPrimary} w-fit`}>
              {createPending ? "Creating…" : "Create game"}
            </button>
          </form>
        )}
      </section>

      {games.length === 0 ? (
        <p className="text-sm text-zinc-500">No games scheduled yet.</p>
      ) : (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 border-b border-zinc-200 pb-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">Game list</h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Showing {filteredGames.length} of {games.length}
                  {listFilter !== "all" || fieldFilter !== "all" ? " (filtered)" : ""}.
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
            <div className="flex flex-col gap-6">
              {filteredGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  fields={fields}
                  poolsWithTeams={poolsWithTeams}
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

  const awayLabel = game.awayTeam ? game.awayTeam.name : "TBD";
  const homeLabel = game.homeTeam ? game.homeTeam.name : "TBD";
  const iso = typeof game.scheduledAt === "string" ? game.scheduledAt : new Date(game.scheduledAt).toISOString();
  const isPoolGame = game.gameKind === GameKind.POOL;

  return (
    <article
      className={`overflow-hidden rounded-xl border bg-white shadow-sm ${gameCardAccentClass(game)}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 bg-zinc-50 px-4 py-3">
        <div>
          <p className="text-xs font-medium text-zinc-500">
            {game.schedulePlaceholder ? (
              <span className="font-semibold text-amber-800">Time TBD</span>
            ) : (
              fmtWhen(iso, tournamentTimezone)
            )}
          </p>
          <p className="text-base font-semibold text-zinc-900">
            {awayLabel} <span className="font-normal text-zinc-400">vs</span> {homeLabel}
          </p>
          <p className="text-xs text-zinc-600">
            {formatFieldWithLocation(game.field.name, game.field.location.name)}
            {game.pool
              ? ` · ${game.pool.division.name} — ${game.pool.name}`
              : game.gameKind === GameKind.CONSOLATION && game.division
                ? ` · ${game.division.name} · Consolation Game`
                : " · Bracket (no pool)"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${adminStatusBadgeClass(game.status)}`}>
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
          {isAdmin ? (
            <ConfirmForm
              message={
                game.poolId
                  ? "Delete this game? Standings will be recalculated for the pool."
                  : game.gameKind === GameKind.CONSOLATION
                    ? "Delete this consolation game? This cannot be undone."
                    : "Delete this bracket game? This cannot be undone."
              }
              action={delAction}
              className="inline"
            >
              <input type="hidden" name="id" value={game.id} />
              <button type="submit" disabled={delPending} className={btnDanger}>
                Delete
              </button>
            </ConfirmForm>
          ) : null}
        </div>
      </div>

      <div className="p-4">
        <ActionMessage state={delState} />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Scoring &amp; innings</h3>
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
              <select name="resultType" defaultValue={game.resultType} className={`${formClass} mt-1 min-w-[10rem]`}>
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
        <div className="border-t border-zinc-100 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Schedule &amp; matchup</h3>
          <ActionMessage state={metaState} />
          <form action={metaAction} className="mt-3 flex flex-col gap-3">
            <input type="hidden" name="id" value={game.id} />
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
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
                <select name="fieldId" required defaultValue={game.fieldId} className={`${formClass} mt-1 w-full`}>
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
            <button type="submit" disabled={metaPending} className={`${btnSecondary} w-fit px-3 py-2 text-sm`}>
              {metaPending ? "Saving…" : "Save schedule & teams"}
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className="border-t border-zinc-100 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Schedule &amp; location</h3>
            <p className="mt-1 text-xs text-zinc-600">
              The wizard stores a placeholder time until you save a real slot here (clears the public “TBD”).
            </p>
            <ActionMessage state={bracketScheduleState} />
            <form action={bracketScheduleAction} className="mt-3 flex flex-col gap-3">
              <input type="hidden" name="id" value={game.id} />
              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                <div>
                  <label className={labelClass}>Field</label>
                  <select name="fieldId" required defaultValue={game.fieldId} className={`${formClass} mt-1 w-full`}>
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
          <div className="border-t border-zinc-100 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Teams (override)</h3>
            <p className="mt-1 text-xs text-zinc-600">Adjust matchups after standings seeding, or fix one-off swaps.</p>
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
    </article>
  );
}
