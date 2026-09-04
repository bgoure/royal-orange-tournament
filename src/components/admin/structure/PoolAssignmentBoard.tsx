"use client";

import {
  startTransition,
  useActionState,
  useMemo,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import {
  savePoolAssignments,
  type ActionResult,
} from "@/app/admin/_actions/structure";
import { ActionMessage } from "@/components/admin/structure/ActionMessage";
import {
  UNASSIGNED,
  balancedCapacityHint,
  changedAssignments,
  initialPlacement,
  moveTeamToPool,
  placementsEqual,
  validatePoolPlacement,
  type PoolAssignmentMap,
  type PoolBoardPool,
  type PoolBoardTeam,
} from "@/components/admin/structure/pool-assignment-state";

export type PoolAssignmentDivision = {
  id: string;
  name: string;
  pools: { id: string; name: string; sortOrder: number }[];
  teams: PoolBoardTeam[];
  publishedBracket: boolean;
};

type Props = {
  divisions: PoolAssignmentDivision[];
  canAssign: boolean;
};

type Selection =
  | { kind: "team"; teamId: string }
  | null;

export function PoolAssignmentBoard({ divisions, canAssign }: Props) {
  const [divisionId, setDivisionId] = useState(divisions[0]?.id ?? "");
  const active = divisions.find((d) => d.id === divisionId) ?? divisions[0] ?? null;

  if (divisions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-sm text-zinc-600">
        Add a division and pools before assigning teams.
      </div>
    );
  }

  if (!active) return null;

  const teamsSignature = active.teams.map((t) => `${t.id}:${t.poolId}`).join("|");

  return (
    <section className="rounded-xl border border-sky-200 bg-sky-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Pool assignment board</h3>
          <p className="mt-1 text-xs text-zinc-600">
            Drag teams between pools, or tap a team then tap a pool. On keyboard: select a team,
            then activate a pool. Changes stay local until you save.
          </p>
        </div>
        <label className="text-xs font-medium text-zinc-600">
          Division
          <select
            value={active.id}
            onChange={(e) => setDivisionId(e.target.value)}
            className="ml-2 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900"
          >
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <PoolAssignmentBoardInner
        key={`${active.id}:${teamsSignature}`}
        division={active}
        canAssign={canAssign}
      />
    </section>
  );
}

function PoolAssignmentBoardInner({
  division,
  canAssign,
}: {
  division: PoolAssignmentDivision;
  canAssign: boolean;
}) {
  const initial = initialPlacement(division.teams);
  const [placement, setPlacement] = useState<PoolAssignmentMap>(initial);
  const [baseline] = useState<PoolAssignmentMap>(initial);
  const [undoStack, setUndoStack] = useState<PoolAssignmentMap[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [dragTeamId, setDragTeamId] = useState<string | null>(null);

  const [state, formAction, pending] = useActionState(
    savePoolAssignments,
    undefined as ActionResult | undefined,
  );

  const pools: PoolBoardPool[] = useMemo(() => {
    const hint = balancedCapacityHint(division.teams.length, division.pools.length);
    return [...division.pools]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((p) => ({ id: p.id, name: p.name, capacityHint: hint }));
  }, [division.pools, division.teams.length]);

  const teams = division.teams;
  const dirty = !placementsEqual(placement, baseline);
  const issues = useMemo(
    () => validatePoolPlacement(placement, teams, pools),
    [placement, teams, pools],
  );
  const blockingIssues = issues.filter((i) => i.kind === "unassigned" || i.kind === "duplicate");
  const changes = changedAssignments(baseline, placement, teams);

  function pushUndo(prev: PoolAssignmentMap) {
    setUndoStack((s) => [...s.slice(-19), prev]);
  }

  function applyMove(teamId: string, poolId: string) {
    if (!canAssign) return;
    setPlacement((prev) => {
      if ((prev[teamId] ?? UNASSIGNED) === poolId) return prev;
      pushUndo(prev);
      return moveTeamToPool(prev, teamId, poolId);
    });
    setSelection(null);
    setDragTeamId(null);
  }

  function resetBoard() {
    setPlacement(baseline);
    setUndoStack([]);
    setSelection(null);
  }

  function undoLast() {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const prev = stack[stack.length - 1]!;
      setPlacement(prev);
      setSelection(null);
      return stack.slice(0, -1);
    });
  }

  function onTeamActivate(teamId: string) {
    if (!canAssign) return;
    setSelection((cur) =>
      cur?.kind === "team" && cur.teamId === teamId ? null : { kind: "team", teamId },
    );
  }

  function onPoolActivate(poolId: string) {
    if (!canAssign || !selection || selection.kind !== "team") return;
    applyMove(selection.teamId, poolId);
  }

  function onTeamKeyDown(e: KeyboardEvent, teamId: string) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onTeamActivate(teamId);
    }
  }

  function onPoolKeyDown(e: KeyboardEvent, poolId: string) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPoolActivate(poolId);
    }
  }

  const unassigned = teams.filter((t) => (placement[t.id] ?? UNASSIGNED) === UNASSIGNED);
  const selectedName =
    selection?.kind === "team"
      ? teams.find((t) => t.id === selection.teamId)?.name ?? "Team"
      : null;

  return (
    <>
      {division.publishedBracket ? (
        <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          This division has a published bracket. Pool moves that would invalidate competition data
          are blocked until you reset structure from{" "}
          <Link href="/admin/structure" className="font-medium underline">
            Structure
          </Link>{" "}
          /{" "}
          <Link href="/admin/brackets" className="font-medium underline">
            Brackets
          </Link>
          .
        </p>
      ) : null}

      {selectedName ? (
        <p className="mt-3 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
          Selected: <strong>{selectedName}</strong> — choose a destination pool
          {canAssign ? (
            <>
              {" "}
              or{" "}
              <button
                type="button"
                className="font-medium underline"
                onClick={() => setSelection(null)}
              >
                cancel
              </button>
            </>
          ) : null}
          .
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canAssign ? (
          <>
            <form
              action={(fd) => {
                fd.set("divisionId", division.id);
                fd.set("assignments", JSON.stringify(changes));
                startTransition(() => {
                  void formAction(fd);
                });
              }}
              className="contents"
            >
              <button
                type="submit"
                disabled={pending || !dirty || blockingIssues.length > 0 || changes.length === 0}
                className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {pending ? "Saving…" : dirty ? "Save assignments" : "Saved"}
              </button>
            </form>
            <button
              type="button"
              disabled={!dirty || pending}
              onClick={resetBoard}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
            >
              Reset
            </button>
            <button
              type="button"
              disabled={undoStack.length === 0 || pending}
              onClick={undoLast}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
            >
              Undo
            </button>
          </>
        ) : (
          <p className="text-xs text-zinc-500">You don’t have permission to reassign teams.</p>
        )}
        {dirty ? (
          <span className="text-xs font-medium text-amber-800">Unsaved changes</span>
        ) : null}
      </div>

      <div className="mt-3">
        <ActionMessage state={state} />
        {state?.ok ? (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-200">
            Pool assignments saved.
          </p>
        ) : null}
        {state && !state.ok && state.requiresStructureReset ? (
          <p className="mt-2 text-xs text-amber-900">
            Use{" "}
            <Link href="/admin/games" className="font-medium underline">
              Games
            </Link>{" "}
            for one-off seat overrides, or reset the structure before moving teams between pools.
          </p>
        ) : null}
      </div>

      {issues.length > 0 ? (
        <div className="mt-3 rounded-md border border-zinc-200 bg-white px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Validation
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-zinc-700">
            {issues.map((issue, i) => (
              <li key={`${issue.kind}-${issue.teamId ?? issue.poolId ?? i}-${i}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pools.map((pool) => {
            const poolTeams = teams.filter((t) => (placement[t.id] ?? UNASSIGNED) === pool.id);
            const highlight = selection?.kind === "team";
            return (
              <div
                key={pool.id}
                role="button"
                tabIndex={canAssign ? 0 : -1}
                aria-label={`Pool ${pool.name}, ${poolTeams.length} teams${
                  pool.capacityHint != null ? `, target ${pool.capacityHint}` : ""
                }`}
                onKeyDown={(e) => onPoolKeyDown(e, pool.id)}
                onClick={() => onPoolActivate(pool.id)}
                onDragOver={(e: DragEvent) => {
                  if (!canAssign) return;
                  e.preventDefault();
                }}
                onDrop={(e: DragEvent) => {
                  e.preventDefault();
                  if (!canAssign || !dragTeamId) return;
                  applyMove(dragTeamId, pool.id);
                }}
                className={
                  "rounded-lg border bg-white p-3 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 " +
                  (highlight
                    ? "border-emerald-400 ring-1 ring-emerald-200"
                    : "border-zinc-200")
                }
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-zinc-900">{pool.name}</p>
                  <p className="text-[11px] text-zinc-500">
                    {poolTeams.length}
                    {pool.capacityHint != null ? ` / ~${pool.capacityHint}` : ""} teams
                  </p>
                </div>
                <div className="mt-2 flex min-h-[48px] flex-wrap gap-1.5">
                  {poolTeams.length === 0 ? (
                    <p className="text-xs text-zinc-400">
                      {highlight ? "Tap to place selected team" : "Drop or tap to place"}
                    </p>
                  ) : (
                    poolTeams.map((t) => (
                      <TeamChip
                        key={t.id}
                        team={t}
                        selected={selection?.kind === "team" && selection.teamId === t.id}
                        disabled={!canAssign}
                        onActivate={() => onTeamActivate(t.id)}
                        onKeyDown={(e) => onTeamKeyDown(e, t.id)}
                        onDragStart={() => setDragTeamId(t.id)}
                        onDragEnd={() => setDragTeamId(null)}
                        moveMenuPools={pools.filter((p) => p.id !== pool.id)}
                        onMoveMenu={(dest) => applyMove(t.id, dest)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="rounded-lg border border-dashed border-sky-300 bg-white/80 p-3"
          onDragOver={(e) => {
            if (!canAssign) return;
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (!canAssign || !dragTeamId) return;
            applyMove(dragTeamId, UNASSIGNED);
          }}
          role="button"
          tabIndex={canAssign ? 0 : -1}
          aria-label="Pending unassigned tray"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (selection?.kind === "team") applyMove(selection.teamId, UNASSIGNED);
            }
          }}
          onClick={() => {
            if (selection?.kind === "team") applyMove(selection.teamId, UNASSIGNED);
          }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-900">
            Pending unassigned
          </p>
          <p className="mt-1 text-[11px] text-sky-900/80">
            Temporary tray only — every team must be in a pool before save.
          </p>
          <div className="mt-2 flex min-h-[40px] flex-wrap gap-1.5">
            {unassigned.length === 0 ? (
              <p className="text-xs text-sky-800/60">Empty</p>
            ) : (
              unassigned.map((t) => (
                <TeamChip
                  key={t.id}
                  team={t}
                  selected={selection?.kind === "team" && selection.teamId === t.id}
                  disabled={!canAssign}
                  onActivate={() => onTeamActivate(t.id)}
                  onKeyDown={(e) => onTeamKeyDown(e, t.id)}
                  onDragStart={() => setDragTeamId(t.id)}
                  onDragEnd={() => setDragTeamId(null)}
                  moveMenuPools={pools}
                  onMoveMenu={(dest) => applyMove(t.id, dest)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function TeamChip({
  team,
  selected,
  disabled,
  onActivate,
  onKeyDown,
  onDragStart,
  onDragEnd,
  moveMenuPools,
  onMoveMenu,
}: {
  team: PoolBoardTeam;
  selected: boolean;
  disabled: boolean;
  onActivate: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  moveMenuPools: PoolBoardPool[];
  onMoveMenu: (poolId: string) => void;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        draggable={!disabled}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onActivate();
        }}
        onKeyDown={onKeyDown}
        onDragStart={() => onDragStart()}
        onDragEnd={onDragEnd}
        aria-pressed={selected}
        className={
          "cursor-grab rounded-md border px-2 py-1 text-xs font-medium active:cursor-grabbing disabled:cursor-default " +
          (selected
            ? "border-emerald-500 bg-emerald-100 text-emerald-950 ring-2 ring-emerald-400"
            : "border-emerald-200 bg-emerald-50 text-emerald-900")
        }
      >
        {team.name}
      </button>
      {!disabled && moveMenuPools.length > 0 ? (
        <label className="sr-only" htmlFor={`move-${team.id}`}>
          Move {team.name}
        </label>
      ) : null}
      {!disabled && moveMenuPools.length > 0 ? (
        <select
          id={`move-${team.id}`}
          aria-label={`Move ${team.name} to pool`}
          className="max-w-[7rem] rounded border border-zinc-300 bg-white py-0.5 text-[10px] text-zinc-700"
          defaultValue=""
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            const v = e.target.value;
            e.target.value = "";
            if (v) onMoveMenu(v);
          }}
        >
          <option value="">Move…</option>
          {moveMenuPools.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      ) : null}
    </span>
  );
}
