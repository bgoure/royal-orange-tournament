"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GameKind, GameResultType, GameStatus } from "@prisma/client";
import { publicGameStatusLabel } from "@/components/schedule/GameList";
import { updateGameScoring, type GameActionResult } from "@/app/admin/_actions/games";
import { ActionMessage } from "@/components/admin/structure/ActionMessage";
import { formatFieldWithLocation } from "@/lib/field-display";
import type { AdminFieldOption, AdminGameRow } from "@/components/admin/games/GamesAdmin";

const SCOREKEEPER_STATUSES: GameStatus[] = [
  GameStatus.SCHEDULED,
  GameStatus.LIVE,
  GameStatus.FINAL,
  GameStatus.AWAITING_RESULTS,
  GameStatus.POSTPONED,
  GameStatus.CANCELLED,
];

const PRIMARY_STATUSES: GameStatus[] = [GameStatus.SCHEDULED, GameStatus.LIVE, GameStatus.FINAL];

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

function statusChipClass(status: GameStatus, selected: boolean) {
  if (!selected) {
    return "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50";
  }
  switch (status) {
    case GameStatus.LIVE:
      return "border-red-600 bg-red-600 text-white";
    case GameStatus.FINAL:
      return "border-emerald-600 bg-emerald-600 text-white";
    case GameStatus.SCHEDULED:
      return "border-zinc-800 bg-zinc-800 text-white";
    default:
      return "border-amber-600 bg-amber-600 text-white";
  }
}

type Props = {
  games: AdminGameRow[];
  fields: AdminFieldOption[];
  tournamentName: string;
  tournamentTimezone: string;
};

export function ScorekeeperView({ games, fields, tournamentName, tournamentTimezone }: Props) {
  const [fieldFilter, setFieldFilter] = useState<string>("all");
  const [hideFinal, setHideFinal] = useState(true);

  const filtered = useMemo(() => {
    let list = [...games].sort((a, b) => {
      const ta = new Date(a.scheduledAt).getTime();
      const tb = new Date(b.scheduledAt).getTime();
      return ta - tb;
    });
    if (fieldFilter !== "all") {
      list = list.filter((g) => g.fieldId === fieldFilter);
    }
    if (hideFinal) {
      list = list.filter((g) => g.status !== GameStatus.FINAL && g.status !== GameStatus.CANCELLED);
    }
    return list;
  }, [games, fieldFilter, hideFinal]);

  return (
    <div className="flex w-full flex-col gap-4 pb-10">
      <header className="sticky top-0 z-20 -mx-4 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Scorekeeper</p>
            <h1 className="truncate text-lg font-semibold text-zinc-900">{tournamentName}</h1>
            <p className="mt-0.5 text-xs text-zinc-500">Large inputs for phones and tablets. Times use {tournamentTimezone}.</p>
          </div>
          <Link
            href="/admin/games"
            className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            Exit
          </Link>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Field</span>
            <select
              value={fieldFilter}
              onChange={(e) => setFieldFilter(e.target.value)}
              className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="all">All fields</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex h-11 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-800 sm:mt-5">
            <input
              type="checkbox"
              checked={hideFinal}
              onChange={(e) => setHideFinal(e.target.checked)}
              className="size-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500/30"
            />
            Hide final / cancelled
          </label>
        </div>
      </header>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-600">
          No games match this filter.{" "}
          {hideFinal ? (
            <button type="button" className="font-semibold text-emerald-800 underline" onClick={() => setHideFinal(false)}>
              Show final games
            </button>
          ) : (
            <Link href="/admin/games" className="font-semibold text-emerald-800 underline">
              Open full Games admin
            </Link>
          )}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {filtered.map((game) => (
            <li key={game.id}>
              <ScorekeeperGameCard game={game} tournamentTimezone={tournamentTimezone} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ScorekeeperGameCard({
  game,
  tournamentTimezone,
}: {
  game: AdminGameRow;
  tournamentTimezone: string;
}) {
  const [scoreState, scoreAction, scorePending] = useActionState(
    updateGameScoring,
    undefined as GameActionResult | undefined,
  );
  const [status, setStatus] = useState(game.status);
  const [awayRuns, setAwayRuns] = useState(game.awayRuns != null ? String(game.awayRuns) : "");
  const [homeRuns, setHomeRuns] = useState(game.homeRuns != null ? String(game.homeRuns) : "");
  const [awayDefIp, setAwayDefIp] = useState(
    game.awayDefensiveInnings != null ? String(game.awayDefensiveInnings) : "",
  );
  const [homeDefIp, setHomeDefIp] = useState(
    game.homeDefensiveInnings != null ? String(game.homeDefensiveInnings) : "",
  );
  const [savedFlash, setSavedFlash] = useState(false);

  const isPoolGame = game.gameKind === GameKind.POOL;
  const awayLabel = game.awayTeam?.name ?? "TBD";
  const homeLabel = game.homeTeam?.name ?? "TBD";
  const iso = typeof game.scheduledAt === "string" ? game.scheduledAt : new Date(game.scheduledAt).toISOString();
  const moreStatuses = SCOREKEEPER_STATUSES.filter((s) => !PRIMARY_STATUSES.includes(s));

  useEffect(() => {
    setStatus(game.status);
    setAwayRuns(game.awayRuns != null ? String(game.awayRuns) : "");
    setHomeRuns(game.homeRuns != null ? String(game.homeRuns) : "");
    setAwayDefIp(game.awayDefensiveInnings != null ? String(game.awayDefensiveInnings) : "");
    setHomeDefIp(game.homeDefensiveInnings != null ? String(game.homeDefensiveInnings) : "");
  }, [game]);

  useEffect(() => {
    if (scoreState?.ok) {
      setSavedFlash(true);
      const t = window.setTimeout(() => setSavedFlash(false), 2000);
      return () => window.clearTimeout(t);
    }
  }, [scoreState]);

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-3">
        <p className="text-xs font-medium text-zinc-500">{fmtWhen(iso, tournamentTimezone)}</p>
        <p className="mt-0.5 text-base font-semibold leading-snug text-zinc-900">
          {awayLabel} <span className="font-normal text-zinc-400">vs</span> {homeLabel}
        </p>
        <p className="mt-1 text-xs text-zinc-600">
          {formatFieldWithLocation(game.field.name, game.field.location.name)}
          {game.pool
            ? ` · ${game.pool.division.name} — ${game.pool.name}`
            : game.gameKind === GameKind.CONSOLATION && game.division
              ? ` · ${game.division.name} · Consolation`
              : " · Bracket"}
        </p>
      </div>

      <form action={scoreAction} className="flex flex-col gap-4 p-4">
        <input type="hidden" name="id" value={game.id} />
        <input type="hidden" name="gameKind" value={game.gameKind} />
        <input type="hidden" name="fieldHomeTeamId" value={game.homeTeamId ?? ""} />
        <input type="hidden" name="resultType" value={game.resultType || GameResultType.REGULAR} />
        <input type="hidden" name="status" value={status} />
        <input type="hidden" name="awayOffensiveInnings" value={game.awayOffensiveInnings ?? ""} />
        <input type="hidden" name="homeOffensiveInnings" value={game.homeOffensiveInnings ?? ""} />
        {!isPoolGame ? (
          <>
            <input type="hidden" name="awayDefensiveInnings" value={game.awayDefensiveInnings ?? ""} />
            <input type="hidden" name="homeDefensiveInnings" value={game.homeDefensiveInnings ?? ""} />
          </>
        ) : null}

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Status</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRIMARY_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`min-h-11 rounded-xl border px-4 text-sm font-semibold ${statusChipClass(s, status === s)}`}
              >
                {publicGameStatusLabel(s)}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {moreStatuses.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`min-h-10 rounded-lg border px-3 text-xs font-semibold ${statusChipClass(s, status === s)}`}
              >
                {publicGameStatusLabel(s)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-zinc-800">
              {awayLabel} <span className="font-normal text-zinc-400">(A)</span>
            </span>
            <input
              name="awayRuns"
              type="number"
              inputMode="numeric"
              min={0}
              value={awayRuns}
              onChange={(e) => setAwayRuns(e.target.value)}
              placeholder="Runs"
              className="h-14 w-full rounded-xl border border-zinc-300 bg-white px-3 text-center text-3xl font-semibold tabular-nums text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-zinc-800">
              {homeLabel} <span className="font-normal text-zinc-400">(H)</span>
            </span>
            <input
              name="homeRuns"
              type="number"
              inputMode="numeric"
              min={0}
              value={homeRuns}
              onChange={(e) => setHomeRuns(e.target.value)}
              placeholder="Runs"
              className="h-14 w-full rounded-xl border border-zinc-300 bg-white px-3 text-center text-3xl font-semibold tabular-nums text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </label>
        </div>

        {isPoolGame ? (
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Def. IP — {awayLabel}
              </span>
              <input
                name="awayDefensiveInnings"
                type="number"
                inputMode="decimal"
                step={0.1}
                min={0}
                value={awayDefIp}
                onChange={(e) => setAwayDefIp(e.target.value)}
                className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-2 text-center text-lg tabular-nums text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Def. IP — {homeLabel}
              </span>
              <input
                name="homeDefensiveInnings"
                type="number"
                inputMode="decimal"
                step={0.1}
                min={0}
                value={homeDefIp}
                onChange={(e) => setHomeDefIp(e.target.value)}
                className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-2 text-center text-lg tabular-nums text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </label>
            <p className="col-span-2 text-[11px] leading-snug text-zinc-500">
              Pool games need defensive innings when runs are entered or the game is marked Final.
            </p>
          </div>
        ) : null}

        <ActionMessage state={scoreState} />

        <button
          type="submit"
          disabled={scorePending}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-emerald-600 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {scorePending ? "Saving…" : savedFlash ? "Saved" : "Save score"}
        </button>
      </form>
    </article>
  );
}
