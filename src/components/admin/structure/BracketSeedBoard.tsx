"use client";

import { useActionState, useMemo, useState, type DragEvent } from "react";
import {
  saveBracketRoundZeroSeeding,
  type BracketActionResult,
} from "@/app/admin/_actions/brackets";
import { ActionMessage } from "@/components/admin/structure/ActionMessage";
export type SeedBoardTeam = { id: string; name: string };

export type ByeSeedSeatProp = {
  label: string;
  team: SeedBoardTeam | null;
};

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
  /** Named format preset (e.g. oba_de_5) — adjusts Round 1 seeding copy. */
  presetKey?: string | null;
  /**
   * Mid-bracket bye-seed seats (discovered from feeders: one open side + one feeder).
   * Used for OBA 5–7 and any map with the same shape.
   */
  byeSeedSeats?: ByeSeedSeatProp[];
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
  presetKey,
  byeSeedSeats = [],
}: SeedBoardProps) {
  const [matches, setMatches] = useState(initialMatches);
  const [byeSeedIds, setByeSeedIds] = useState<(string | null)[]>(() =>
    byeSeedSeats.map((s) => s.team?.id ?? null),
  );
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
    for (const s of byeSeedSeats) {
      if (s.team) m.set(s.team.id, s.team.name);
    }
    return m;
  }, [teams, initialMatches, byeSeedSeats]);

  const placedTeamIds = useMemo(() => {
    const ids = new Set<string>();
    for (const match of matches) {
      if (match.home.kind === "team") ids.add(match.home.teamId);
      if (match.away.kind === "team") ids.add(match.away.teamId);
    }
    for (const id of byeSeedIds) {
      if (id) ids.add(id);
    }
    return ids;
  }, [matches, byeSeedIds]);

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

  function removeTeamFromByeSeeds(teamId: string) {
    setByeSeedIds((prev) => prev.map((id) => (id === teamId ? null : id)));
  }

  function placeOnByeSeed(index: number, payload: DragPayload) {
    if (payload.type !== "team") return;
    let displaced: string | null = null;
    setByeSeedIds((prev) => {
      const next = [...prev];
      displaced = next[index] ?? null;
      for (let i = 0; i < next.length; i++) {
        if (next[i] === payload.teamId) next[i] = null;
      }
      next[index] = payload.teamId;
      return next;
    });
    setMatches((prev) => {
      let next = prev.map((m) => {
        let home = m.home;
        let away = m.away;
        if (home.kind === "team" && home.teamId === payload.teamId) home = { kind: "empty" };
        if (away.kind === "team" && away.teamId === payload.teamId) away = { kind: "empty" };
        return home === m.home && away === m.away ? m : { ...m, home, away };
      });
      if (payload.from && displaced) {
        const { matchId: fromId, side: fromSide } = payload.from;
        const swapTeamId = displaced;
        next = next.map((m) =>
          m.matchId === fromId
            ? {
                ...m,
                [fromSide]: {
                  kind: "team" as const,
                  teamId: swapTeamId,
                  name: teamNameById.get(swapTeamId) ?? "Team",
                },
              }
            : m,
        );
      } else if (payload.from) {
        const { matchId: fromId, side: fromSide } = payload.from;
        next = next.map((m) =>
          m.matchId === fromId ? { ...m, [fromSide]: { kind: "empty" as const } } : m,
        );
      }
      return next;
    });
  }

  function placeOn(matchId: string, side: SlotSide, payload: DragPayload) {
    if (payload.type === "team") {
      removeTeamFromByeSeeds(payload.teamId);
    }
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
  const byeSeedTeamIdsJson = JSON.stringify(byeSeedIds.filter((id): id is string => id != null));
  const byeSeedsReady =
    byeSeedSeats.length === 0 ||
    (byeSeedIds.length === byeSeedSeats.length && byeSeedIds.every((id) => id != null));

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Round 1 seed board</h3>
          <p className="mt-1 text-xs text-zinc-600">
            {bracketName} — drag teams into Away / Home seats. Teams that sit out Round 1 belong in{" "}
            <span className="font-medium">Sitting out</span> (not on the yellow BYE chip). Drop the
            BYE chip onto a seat only when that seat is a walkover.
          </p>
        </div>
        {editable ? (
          <form action={formAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="bracketId" value={bracketId} />
            <input type="hidden" name="slots" value={slotsJson} />
            <input type="hidden" name="byeSeedTeamIds" value={byeSeedTeamIdsJson} />
            <button
              type="submit"
              disabled={pending || !byeSeedsReady}
              title={
                byeSeedsReady
                  ? undefined
                  : "Assign every Round 1 bye seed (Seed 1 / Seed 2) before saving"
              }
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

      {presetKey === "oba_de_5" && matches.length === 1 ? (
        <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          This bracket still has the older 1-game Round 1 layout. Delete it under Brackets and
          recreate with <span className="font-semibold">Double elimination — 5 teams (seeded)</span>{" "}
          so Round 1 is Games 1–2 and Round 2 is G3+G4; seed 1 byes into G3.
        </p>
      ) : null}

      {presetKey === "oba_de_5" && matches.length === 2 ? (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-950">
          Seeded 5-team map: Round 1 is two games (4 vs 5, 2 vs 3). Drop <strong>Seed 1</strong> into
          the bye slot on the right — they fill G3 home (Round 2).
        </p>
      ) : null}

      {presetKey === "oba_de_6" && matches.length === 2 ? (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-950">
          Seeded 6-team map: Round 1 is 4 vs 5 and 3 vs 6. Drop <strong>Seed 1</strong> and{" "}
          <strong>Seed 2</strong> into the bye slots on the right — they fill G3 / G4 home (Round 2).
          Opponent seats stay TBD until Round 1 winners advance.
        </p>
      ) : null}

      {presetKey === "oba_de_7" && matches.length === 3 ? (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-950">
          Seeded 7-team map: Round 1 is three games. Drop <strong>Seed 1</strong> into the bye slot on
          the right — they fill G5 home (Round 2). Opponent stays TBD until the Round 1 winner advances.
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
            {byeSeedSeats.length > 0 ? (
              <div className="rounded-lg border border-dashed border-sky-300 bg-sky-50/80 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-900">
                  Round 1 bye seeds
                </p>
                <p className="mt-1 text-[11px] leading-snug text-sky-900/80">
                  Drop the strongest remaining teams here (Seed 1 = strongest). Save writes them onto
                  later-round seats; the feeder opponent stays TBD until Round 1 is played.
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {byeSeedSeats.map((seat, index) => {
                    const teamId = byeSeedIds[index] ?? null;
                    return (
                      <div
                        key={`${seat.label}-${index}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (!drag) return;
                          placeOnByeSeed(index, drag);
                          setDrag(null);
                        }}
                        className="min-h-[52px] rounded-md border border-sky-200 bg-white px-2 py-1.5"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-800">
                          {seat.label}
                        </p>
                        <div className="mt-1">
                          {teamId ? (
                            <button
                              type="button"
                              draggable
                              onDragStart={() => setDrag({ type: "team", teamId })}
                              onDragEnd={() => setDrag(null)}
                              onClick={() =>
                                setByeSeedIds((prev) =>
                                  prev.map((id, i) => (i === index ? null : id)),
                                )
                              }
                              title="Click to remove · drag to move"
                              className="cursor-grab rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-900"
                            >
                              {teamNameById.get(teamId) ?? "Team"}
                            </button>
                          ) : (
                            <p className="text-xs text-sky-700/70">Drop seed {index + 1}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div
                className="rounded-lg border border-dashed border-sky-300 bg-sky-50/80 p-3"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (drag?.type === "team" || drag?.type === "bye") {
                    if (drag.from) clearSide(drag.from.matchId, drag.from.side);
                    setDrag(null);
                  }
                }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-900">
                  Sitting out (Round 1 bye)
                </p>
                <div className="mt-2 flex min-h-[48px] flex-wrap gap-1.5">
                  {bankTeams.length === 0 ? (
                    <p className="text-xs text-sky-800/70">All teams are in Round 1 seats</p>
                  ) : (
                    bankTeams.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        draggable
                        onDragStart={() => setDrag({ type: "team", teamId: t.id })}
                        onDragEnd={() => setDrag(null)}
                        className="cursor-grab rounded-md border border-sky-300 bg-white px-2 py-1 text-xs font-medium text-sky-950 active:cursor-grabbing"
                      >
                        {t.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {byeSeedSeats.length > 0 && bankTeams.length > 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/80 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  Unplaced teams
                </p>
                <div className="mt-2 flex min-h-[40px] flex-wrap gap-1.5">
                  {bankTeams.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      draggable
                      onDragStart={() => setDrag({ type: "team", teamId: t.id })}
                      onDragEnd={() => setDrag(null)}
                      className="cursor-grab rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 active:cursor-grabbing"
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/80 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                BYE chip (walkover)
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
                Drag onto an Away/Home seat for a walkover. Formats with mid-round bye seeds use the
                slots above instead of this chip for top seeds.
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
