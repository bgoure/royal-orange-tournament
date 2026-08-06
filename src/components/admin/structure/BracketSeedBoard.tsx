"use client";

import { useActionState, useMemo, useState, type DragEvent } from "react";
import {
  saveBracketRoundZeroSeeding,
  type BracketActionResult,
} from "@/app/admin/_actions/brackets";
import { ActionMessage } from "@/components/admin/structure/ActionMessage";

export type SeedBoardTeam = { id: string; name: string };

export type SeedBoardSide =
  | { kind: "team"; teamId: string; name: string }
  | { kind: "bye" }
  | { kind: "empty" };

export type SeedBoardMatch = {
  matchId: string;
  matchIndex: number;
  home: SeedBoardSide;
  away: SeedBoardSide;
  locked: boolean;
};

export type SeedBoardProps = {
  bracketId: string;
  bracketName: string;
  teams: SeedBoardTeam[];
  matches: SeedBoardMatch[];
  canConfigure: boolean;
};

type SlotSide = "home" | "away";
type DragPayload =
  | { type: "team"; teamId: string; from?: { matchId: string; side: SlotSide } }
  | { type: "bye"; from?: { matchId: string; side: SlotSide } };

function sideToSave(side: SeedBoardSide): { bye: true } | { teamId: string } {
  if (side.kind === "team") return { teamId: side.teamId };
  return { bye: true };
}

export function BracketSeedBoard({
  bracketId,
  bracketName,
  teams,
  matches: initialMatches,
  canConfigure,
}: SeedBoardProps) {
  const [matches, setMatches] = useState(initialMatches);
  const [drag, setDrag] = useState<DragPayload | null>(null);
  const [state, formAction, pending] = useActionState(
    saveBracketRoundZeroSeeding,
    undefined as BracketActionResult | undefined,
  );

  const teamNameById = useMemo(() => {
    const m = new Map(teams.map((t) => [t.id, t.name]));
    for (const match of initialMatches) {
      for (const side of [match.home, match.away]) {
        if (side.kind === "team") m.set(side.teamId, side.name);
      }
    }
    return m;
  }, [teams, initialMatches]);

  const placedTeamIds = useMemo(() => {
    const ids = new Set<string>();
    for (const match of matches) {
      if (match.home.kind === "team") ids.add(match.home.teamId);
      if (match.away.kind === "team") ids.add(match.away.teamId);
    }
    return ids;
  }, [matches]);

  const bankTeams = teams.filter((t) => !placedTeamIds.has(t.id));
  const anyLocked = matches.some((m) => m.locked);
  const editable = canConfigure && !anyLocked;

  function clearSide(matchId: string, side: SlotSide) {
    setMatches((prev) =>
      prev.map((m) =>
        m.matchId === matchId ? { ...m, [side]: { kind: "empty" as const } } : m,
      ),
    );
  }

  function placeOn(matchId: string, side: SlotSide, payload: DragPayload) {
    setMatches((prev) => {
      const target = prev.find((m) => m.matchId === matchId);
      if (!target || target.locked) return prev;

      const incoming: SeedBoardSide =
        payload.type === "bye"
          ? { kind: "bye" }
          : {
              kind: "team",
              teamId: payload.teamId,
              name: teamNameById.get(payload.teamId) ?? "Team",
            };

      const displaced = target[side];
      let next = prev.map((m) =>
        m.matchId === matchId ? { ...m, [side]: incoming } : m,
      );

      if (payload.from) {
        const { matchId: fromId, side: fromSide } = payload.from;
        if (fromId !== matchId || fromSide !== side) {
          const swapIn: SeedBoardSide =
            displaced.kind === "empty" ? { kind: "empty" } : displaced;
          next = next.map((m) =>
            m.matchId === fromId ? { ...m, [fromSide]: swapIn } : m,
          );
        }
      } else if (payload.type === "team") {
        next = next.map((m) => {
          if (m.matchId === matchId) return m;
          let home = m.home;
          let away = m.away;
          if (home.kind === "team" && home.teamId === payload.teamId) home = { kind: "empty" };
          if (away.kind === "team" && away.teamId === payload.teamId) away = { kind: "empty" };
          return home === m.home && away === m.away ? m : { ...m, home, away };
        });
      }

      return next;
    });
  }

  const slotsJson = JSON.stringify(
    matches.map((m) => ({
      matchId: m.matchId,
      home: sideToSave(m.home),
      away: sideToSave(m.away),
    })),
  );

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Round 1 seed board</h3>
          <p className="mt-1 text-xs text-zinc-600">
            {bracketName} — drag teams (or BYE) into Away / Home. Empty seats save as BYE. Drop onto
            an occupied seat to swap.
          </p>
        </div>
        {editable ? (
          <form action={formAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="bracketId" value={bracketId} />
            <input type="hidden" name="slots" value={slotsJson} />
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save Round 1"}
            </button>
          </form>
        ) : null}
      </div>

      <div className="mt-3">
        <ActionMessage state={state} />
        {state?.ok ? (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-200">
            Round 1 seeding saved.
          </p>
        ) : null}
      </div>

      {anyLocked ? (
        <p className="mt-3 text-xs text-amber-900">
          Round 1 has a live or scored game — reseating is locked until that game is cleared.
        </p>
      ) : null}

      {!canConfigure ? (
        <p className="mt-3 text-xs text-zinc-500">You don’t have permission to edit Round 1 seeds.</p>
      ) : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="flex flex-col gap-2">
          {matches.map((match) => (
            <div
              key={match.matchId}
              className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Game {match.matchIndex + 1}
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(["away", "home"] as const).map((side) => (
                  <DropSeat
                    key={side}
                    label={side === "away" ? "Away" : "Home"}
                    side={match[side]}
                    disabled={!editable || match.locked}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (!drag || match.locked) return;
                      placeOn(match.matchId, side, drag);
                      setDrag(null);
                    }}
                    onDragStartChip={() => {
                      const s = match[side];
                      if (s.kind === "team") {
                        setDrag({
                          type: "team",
                          teamId: s.teamId,
                          from: { matchId: match.matchId, side },
                        });
                      } else if (s.kind === "bye") {
                        setDrag({
                          type: "bye",
                          from: { matchId: match.matchId, side },
                        });
                      }
                    }}
                    onDragEndChip={() => setDrag(null)}
                    onClear={() => clearSide(match.matchId, side)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {editable ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Unassigned teams
              </p>
              <div
                className="mt-2 flex min-h-[48px] flex-wrap gap-1.5"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (!drag?.from) return;
                  if (drag.type === "team" || drag.type === "bye") {
                    clearSide(drag.from.matchId, drag.from.side);
                  }
                  setDrag(null);
                }}
              >
                {bankTeams.length === 0 ? (
                  <p className="text-xs text-zinc-500">All teams placed</p>
                ) : (
                  bankTeams.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      draggable
                      onDragStart={() => setDrag({ type: "team", teamId: t.id })}
                      onDragEnd={() => setDrag(null)}
                      className="cursor-grab rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-800 active:cursor-grabbing"
                    >
                      {t.name}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/80 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                BYE chip
              </p>
              <button
                type="button"
                draggable
                onDragStart={() => setDrag({ type: "bye" })}
                onDragEnd={() => setDrag(null)}
                className="mt-2 cursor-grab rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-semibold text-amber-950 active:cursor-grabbing"
              >
                BYE
              </button>
              <p className="mt-2 text-[11px] leading-snug text-amber-900/80">
                Drop onto a seat for a walkover. Empty seats also save as BYE.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DropSeat({
  label,
  side,
  disabled,
  onDragOver,
  onDrop,
  onDragStartChip,
  onDragEndChip,
  onClear,
}: {
  label: string;
  side: SeedBoardSide;
  disabled: boolean;
  onDragOver: (e: DragEvent) => void;
  onDrop: () => void;
  onDragStartChip: () => void;
  onDragEndChip: () => void;
  onClear: () => void;
}) {
  return (
    <div
      onDragOver={disabled ? undefined : onDragOver}
      onDrop={disabled ? undefined : onDrop}
      className="min-h-[52px] rounded-md border border-zinc-200 bg-zinc-50/80 px-2 py-1.5"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <div className="mt-1">
        {side.kind === "empty" ? (
          <p className="text-xs text-zinc-400">Drop team or BYE</p>
        ) : (
          <button
            type="button"
            draggable={!disabled}
            disabled={disabled}
            onDragStart={disabled ? undefined : onDragStartChip}
            onDragEnd={disabled ? undefined : onDragEndChip}
            onClick={disabled ? undefined : onClear}
            title={disabled ? undefined : "Click to remove · drag to move"}
            className={
              side.kind === "bye"
                ? "cursor-grab rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-950 disabled:cursor-default"
                : "cursor-grab rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-900 disabled:cursor-default"
            }
          >
            {side.kind === "bye" ? "BYE" : side.name}
          </button>
        )}
      </div>
    </div>
  );
}
