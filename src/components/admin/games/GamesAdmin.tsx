"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { GameResultType, GameStatus } from "@prisma/client";
import type { Division, Field, Game, Pool, Team } from "@prisma/client";
import { formatFieldWithLocation } from "@/lib/field-display";
import {
  createGame,
  deleteGame,
  updateGameMeta,
  updateGameScoring,
  type GameActionResult,
} from "@/app/admin/_actions/games";
import { ActionMessage } from "@/components/admin/structure/ActionMessage";
import { ConfirmForm } from "@/components/admin/structure/ConfirmForm";

export type AdminGameRow = Game & {
  homeTeam: Team | null;
  awayTeam: Team | null;
  field: Field & { location: { name: string } };
  pool: (Pool & { division: Division }) | null;
};

export type PoolWithTeams = {
  poolId: string;
  label: string;
  teams: { id: string; name: string; abbreviation: string | null }[];
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

function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fmtWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
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
  isAdmin: boolean;
};

export function GamesAdmin({ games, fields, poolsWithTeams, tournamentName, isAdmin }: Props) {
  const [createState, createAction, createPending] = useActionState(createGame, undefined as GameActionResult | undefined);
  const [poolId, setPoolId] = useState(poolsWithTeams[0]?.poolId ?? "");

  const teamOptions = useMemo(() => {
    const p = poolsWithTeams.find((x) => x.poolId === poolId);
    return p?.teams ?? [];
  }, [poolsWithTeams, poolId]);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Tournament</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Games</h1>
          <p className="mt-1 text-sm text-zinc-600">{tournamentName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
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

      <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-6">
        <h2 className="text-sm font-semibold text-zinc-900">New pool game</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Pool play games belong to a division pool. Both teams must be assigned to that pool. Runs allowed are implied
          from the opponent&apos;s runs scored.
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
                  Start
                </label>
                <input id="cg-when" name="scheduledAt" type="datetime-local" required className={`${formClass} mt-1 w-full`} />
              </div>
              <div>
                <label htmlFor="cg-away" className={labelClass}>
                  Away
                </label>
                <select id="cg-away" name="awayTeamId" required className={`${formClass} mt-1 w-full`}>
                  <option value="">Select…</option>
                  {teamOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.abbreviation ? `${t.abbreviation} — ${t.name}` : t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="cg-home" className={labelClass}>
                  Home
                </label>
                <select id="cg-home" name="homeTeamId" required className={`${formClass} mt-1 w-full`}>
                  <option value="">Select…</option>
                  {teamOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.abbreviation ? `${t.abbreviation} — ${t.name}` : t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="cg-status" className={labelClass}>
                  Status
                </label>
                <select id="cg-status" name="status" className={`${formClass} mt-1 w-full`} defaultValue="SCHEDULED">
                  {GAME_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
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
        <div className="flex flex-col gap-6">
          {games.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              fields={fields}
              poolsWithTeams={poolsWithTeams}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const GAME_STATUS_OPTIONS: GameStatus[] = [
  GameStatus.SCHEDULED,
  GameStatus.LIVE,
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
  isAdmin,
}: {
  game: AdminGameRow;
  fields: AdminFieldOption[];
  poolsWithTeams: PoolWithTeams[];
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
  const [delState, delAction, delPending] = useActionState(deleteGame, undefined as GameActionResult | undefined);

  const [metaPoolId, setMetaPoolId] = useState(game.poolId ?? poolsWithTeams[0]?.poolId ?? "");
  const metaTeams = useMemo(() => {
    const p = poolsWithTeams.find((x) => x.poolId === metaPoolId);
    return p?.teams ?? [];
  }, [poolsWithTeams, metaPoolId]);

  const awayLabel = game.awayTeam ? (game.awayTeam.abbreviation ?? game.awayTeam.name) : "TBD";
  const homeLabel = game.homeTeam ? (game.homeTeam.abbreviation ?? game.homeTeam.name) : "TBD";
  const iso = typeof game.scheduledAt === "string" ? game.scheduledAt : new Date(game.scheduledAt).toISOString();

  return (
    <article className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 bg-zinc-50 px-4 py-3">
        <div>
          <p className="text-xs font-medium text-zinc-500">{fmtWhen(iso)}</p>
          <p className="text-base font-semibold text-zinc-900">
            {awayLabel} <span className="font-normal text-zinc-400">@</span> {homeLabel}
          </p>
          <p className="text-xs text-zinc-600">
            {formatFieldWithLocation(game.field.name, game.field.location.name)}
            {game.pool
              ? ` · ${game.pool.division.name} — ${game.pool.name}`
              : " · Bracket (no pool)"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              game.status === "LIVE"
                ? "bg-red-100 text-red-800"
                : game.status === "FINAL"
                  ? "bg-emerald-100 text-emerald-900"
                  : "bg-zinc-200 text-zinc-800"
            }`}
          >
            {game.status}
          </span>
          {isAdmin ? (
            <ConfirmForm
              message="Delete this game? Standings will be recalculated for the pool."
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
          Away runs / defensive innings · Home runs / defensive innings. Offensive innings default from opponent
          defensive when left blank on save.
        </p>
        <ActionMessage state={scoreState} />
        <form action={scoreAction} className="mt-3">
          <input type="hidden" name="id" value={game.id} />
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <span className={labelClass}>Away runs</span>
                <input
                  name="awayRuns"
                  type="number"
                  min={0}
                  defaultValue={game.awayRuns ?? ""}
                  className={`${formClass} mt-1 w-20`}
                />
              </div>
              <div>
                <span className={labelClass}>Away def. IP</span>
                <input
                  name="awayDefensiveInnings"
                  type="number"
                  step={0.1}
                  min={0}
                  defaultValue={game.awayDefensiveInnings ?? ""}
                  className={`${formClass} mt-1 w-24`}
                />
              </div>
              <div>
                <span className={labelClass}>Home runs</span>
                <input
                  name="homeRuns"
                  type="number"
                  min={0}
                  defaultValue={game.homeRuns ?? ""}
                  className={`${formClass} mt-1 w-20`}
                />
              </div>
              <div>
                <span className={labelClass}>Home def. IP</span>
                <input
                  name="homeDefensiveInnings"
                  type="number"
                  step={0.1}
                  min={0}
                  defaultValue={game.homeDefensiveInnings ?? ""}
                  className={`${formClass} mt-1 w-24`}
                />
              </div>
            </div>
            <div>
              <span className={labelClass}>Off. IP (opt)</span>
              <div className="mt-1 flex gap-2">
                <input
                  name="awayOffensiveInnings"
                  type="number"
                  step={0.1}
                  min={0}
                  placeholder="away"
                  defaultValue={game.awayOffensiveInnings ?? ""}
                  className={`${formClass} w-20`}
                />
                <input
                  name="homeOffensiveInnings"
                  type="number"
                  step={0.1}
                  min={0}
                  placeholder="home"
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
                    {s}
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
                <label className={labelClass}>Start</label>
                <input
                  name="scheduledAt"
                  type="datetime-local"
                  required
                  defaultValue={toDatetimeLocalValue(iso)}
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
                      {t.abbreviation ? `${t.abbreviation} — ${t.name}` : t.name}
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
                      {t.abbreviation ? `${t.abbreviation} — ${t.name}` : t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button type="submit" disabled={metaPending} className={`${btnSecondary} w-fit px-3 py-2 text-sm`}>
              {metaPending ? "Saving…" : "Save schedule & teams"}
            </button>
          </form>
        </div>
      ) : (
        <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
          Playoff game: teams fill automatically when prior-round games go FINAL (or from first-round seeding).
          Use scoring below; schedule field/time can be adjusted when bracket games support full edit.
        </div>
      )}
    </article>
  );
}
