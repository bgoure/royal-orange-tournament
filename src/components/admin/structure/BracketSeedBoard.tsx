"use client";

import {
  startTransition,
  useActionState,
  useMemo,
  useReducer,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import {
  saveBracketRoundZeroSeeding,
  type BracketActionResult,
} from "@/app/admin/_actions/brackets";
import { ActionMessage } from "@/components/admin/structure/ActionMessage";
import {
  bankTeams as filterBankTeams,
  byeSeedsReady as computeByeSeedsReady,
  createBaseline,
  createInitialSeedBoardState,
  isBoardDirty,
  seedBoardReducer,
  selectionToPayload,
  toSavePayload,
  type DragPayload,
  type SeedBoardMatch,
  type SeedBoardSide,
  type SeedBoardTeam,
  type SlotSide,
} from "@/components/admin/structure/bracket-seed-board-state";

export type { SeedBoardTeam, SeedBoardSide, SeedBoardMatch };

export type ByeSeedSeatProp = {
  label: string;
  team: SeedBoardTeam | null;
};

export type SeedBoardProps = {
  bracketId: string;
  bracketName: string;
  teams: SeedBoardTeam[];
  matches: SeedBoardMatch[];
  canConfigure: boolean;
  presetKey?: string | null;
  byeSeedSeats?: ByeSeedSeatProp[];
};

export function BracketSeedBoard({
  bracketId,
  bracketName,
  teams,
  matches: initialMatches,
  canConfigure,
  presetKey,
  byeSeedSeats = [],
}: SeedBoardProps) {
  const baseline = useMemo(
    () =>
      createBaseline(
        initialMatches,
        byeSeedSeats.map((s) => s.team?.id ?? null),
      ),
    [initialMatches, byeSeedSeats],
  );

  const [board, dispatch] = useReducer(seedBoardReducer, baseline, createInitialSeedBoardState);
  const [drag, setDrag] = useState<DragPayload | null>(null);
  const [actionState, formAction, pending] = useActionState(
    saveBracketRoundZeroSeeding,
    undefined as BracketActionResult | undefined,
  );

  const { matches, byeSeedIds, undoStack, selection, ackImpact } = board;

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

  const bankTeams = filterBankTeams(teams, board);
  const anyLocked = matches.some((m) => m.locked);
  const editable = canConfigure && !anyLocked;
  const dirty = isBoardDirty(board, baseline);

  const slotErrorByMatch = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!actionState || actionState.ok || !actionState.slotErrors) return map;
    for (const err of actionState.slotErrors) {
      if (!err.matchId) continue;
      const list = map.get(err.matchId) ?? [];
      list.push(err.message);
      map.set(err.matchId, list);
    }
    return map;
  }, [actionState]);

  function placeOn(matchId: string, side: SlotSide, payload: DragPayload) {
    dispatch({ type: "PLACE_ON", matchId, side, payload, teamNameById, editable });
  }

  function placeOnByeSeed(index: number, payload: DragPayload) {
    dispatch({ type: "PLACE_BYE_SEED", index, payload, teamNameById, editable });
  }

  function clearSide(matchId: string, side: SlotSide) {
    dispatch({ type: "CLEAR_SIDE", matchId, side, editable });
  }

  function resetBoard() {
    dispatch({ type: "RESET", baseline });
  }

  function undoLast() {
    dispatch({ type: "UNDO" });
  }

  function applySelectionToSeat(matchId: string, side: SlotSide) {
    const payload = selectionToPayload(selection, matches);
    if (!payload) return;
    placeOn(matchId, side, payload);
  }

  function applySelectionToByeSeed(index: number) {
    const payload = selectionToPayload(selection, matches);
    if (!payload || payload.type !== "team") return;
    placeOnByeSeed(index, payload);
  }

  function toggleTeamSelection(teamId: string) {
    dispatch({ type: "TOGGLE_TEAM", teamId, editable });
  }

  function toggleByeSelection() {
    dispatch({ type: "TOGGLE_BYE", editable });
  }

  const savePayload = toSavePayload(board);
  const slotsJson = JSON.stringify(savePayload.slots);
  const byeSeedTeamIdsJson = JSON.stringify(savePayload.byeSeedTeamIds);
  const byeSeedsReady = computeByeSeedsReady(byeSeedSeats.length, byeSeedIds);

  const selectedLabel =
    selection?.kind === "bye"
      ? "BYE (walkover)"
      : selection?.kind === "team"
        ? teamNameById.get(selection.teamId) ?? "Team"
        : null;

  const needsAck = Boolean(actionState && !actionState.ok && actionState.requiresAck);

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Round 1 seed board</h3>
          <p className="mt-1 text-xs text-zinc-600">
            {bracketName} — drag teams into Away / Home seats, or tap a team then tap a seat.
            Empty seats, team seats, structural BYE walkovers, and sitting-out / bye-seed seats are
            distinct. Later-round winner/loser feeders are not droppable here.
          </p>
        </div>
        {editable ? (
          <div className="flex flex-wrap items-center gap-2">
            <form
              action={(fd) => {
                fd.set("bracketId", bracketId);
                fd.set("slots", slotsJson);
                fd.set("byeSeedTeamIds", byeSeedTeamIdsJson);
                if (ackImpact) fd.set("acknowledgeImpact", "1");
                startTransition(() => {
                  void formAction(fd);
                });
              }}
              className="contents"
            >
              <button
                type="submit"
                disabled={pending || !byeSeedsReady || (needsAck && !ackImpact)}
                title={
                  !byeSeedsReady
                    ? "Assign every Round 1 bye seed (Seed 1 / Seed 2) before saving"
                    : needsAck && !ackImpact
                      ? "Confirm the impact warning before saving"
                      : undefined
                }
                className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {pending ? "Saving…" : needsAck ? "Confirm & save Round 1" : "Save Round 1"}
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
            {dirty ? (
              <span className="text-xs font-medium text-amber-800">Unsaved changes</span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-3">
        <ActionMessage state={actionState} />
        {actionState?.ok ? (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-200">
            Round 1 seeding saved.
          </p>
        ) : null}
        {needsAck ? (
          <label className="mt-2 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={ackImpact}
              onChange={(e) => dispatch({ type: "SET_ACK", value: e.target.checked })}
            />
            <span>
              I understand later-round seats will be cleared for unplayed games. This does not delete
              the bracket or regenerate the schedule. Check the box, then press{" "}
              <strong>Confirm &amp; save Round 1</strong>.
            </span>
          </label>
        ) : null}
      </div>

      {anyLocked ? (
        <p className="mt-3 text-xs text-amber-900">
          Round 1 has a live or scored game — reseating is locked. For administrative one-off seat
          fixes, use{" "}
          <Link href="/admin/games" className="font-medium underline">
            Games → Teams (override)
          </Link>
          .
        </p>
      ) : null}

      {selectedLabel ? (
        <p className="mt-3 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
          Selected: <strong>{selectedLabel}</strong> — tap an Away/Home seat
          {byeSeedSeats.length > 0 ? " or bye-seed slot" : ""} to place
          {selection?.kind === "team" ? " / swap" : ""}.{" "}
          <button type="button" className="font-medium underline" onClick={() => dispatch({ type: "CLEAR_SELECTION" })}>
            Cancel
          </button>
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

      {presetKey === "oba_de_13" && matches.length === 6 ? (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-950">
          13-team draw: Round 1 is six games. Drop <strong>Team 1</strong> (first drawn) into the bye
          slot on the right — they fill G10 home (Round 2). Winner of Game 1 sits Round 2 into G16.
        </p>
      ) : null}

      {presetKey === "oba_de_12" && matches.length === 6 ? (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-950">
          12-team draw: Round 1 is six games and every team plays. First drawn is Game 1 home. Winner
          of Game 10 sits Round 3 and plays Game 19 in Round 4.
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
                {match.locked ? " · locked" : ""}
              </p>
              {slotErrorByMatch.get(match.matchId)?.map((msg, i) => (
                <p key={i} className="mt-1 text-xs text-red-700" role="alert">
                  {msg}
                </p>
              ))}
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(["away", "home"] as const).map((side) => (
                  <DropSeat
                    key={side}
                    label={side === "away" ? "Away" : "Home"}
                    side={match[side]}
                    disabled={!editable || match.locked}
                    selectedTarget={Boolean(selection)}
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
                    onActivateSeat={() => {
                      if (selection) applySelectionToSeat(match.matchId, side);
                      else if (match[side].kind === "team") {
                        toggleTeamSelection(match[side].teamId);
                      } else if (match[side].kind === "bye") {
                        toggleByeSelection();
                      }
                    }}
                    onChipKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (selection) applySelectionToSeat(match.matchId, side);
                      }
                      if (e.key === "Backspace" || e.key === "Delete") {
                        e.preventDefault();
                        clearSide(match.matchId, side);
                      }
                    }}
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
                  Strongest remaining teams (Seed 1 = strongest). Save writes them onto later-round
                  seats; the feeder opponent stays TBD until Round 1 is played — not a droppable
                  winner/loser feeder.
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {byeSeedSeats.map((seat, index) => {
                    const teamId = byeSeedIds[index] ?? null;
                    const byeErr =
                      actionState &&
                      !actionState.ok &&
                      actionState.slotErrors?.find((e) => e.byeSeedIndex === index)?.message;
                    return (
                      <div
                        key={`${seat.label}-${index}`}
                        role="button"
                        tabIndex={0}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (!drag) return;
                          placeOnByeSeed(index, drag);
                          setDrag(null);
                        }}
                        onClick={() => {
                          if (selection?.kind === "team") applySelectionToByeSeed(index);
                        }}
                        onKeyDown={(e: KeyboardEvent) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            if (selection?.kind === "team") applySelectionToByeSeed(index);
                          }
                        }}
                        className={
                          "min-h-[52px] rounded-md border bg-white px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-sky-500 " +
                          (selection?.kind === "team"
                            ? "border-sky-400 ring-1 ring-sky-200"
                            : "border-sky-200")
                        }
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-800">
                          {seat.label}
                        </p>
                        {byeErr ? (
                          <p className="text-[11px] text-red-700" role="alert">
                            {byeErr}
                          </p>
                        ) : null}
                        <div className="mt-1">
                          {teamId ? (
                            <button
                              type="button"
                              draggable
                              onDragStart={() => setDrag({ type: "team", teamId })}
                              onDragEnd={() => setDrag(null)}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (selection) {
                                  applySelectionToByeSeed(index);
                                } else {
                                  dispatch({ type: "CLEAR_BYE_SEED", index, editable });
                                }
                              }}
                              title="Click to remove · drag or select to move"
                              aria-pressed={
                                selection?.kind === "team" && selection.teamId === teamId
                              }
                              className={
                                "cursor-grab rounded-md border px-2 py-1 text-xs font-medium " +
                                (selection?.kind === "team" && selection.teamId === teamId
                                  ? "border-emerald-500 bg-emerald-100 text-emerald-950 ring-2 ring-emerald-400"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-900")
                              }
                            >
                              {teamNameById.get(teamId) ?? "Team"}
                            </button>
                          ) : (
                            <p className="text-xs text-sky-700/70">
                              {selection?.kind === "team"
                                ? "Tap to place selected team"
                                : `Drop seed ${index + 1}`}
                            </p>
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
                    else if (drag.type === "team") {
                      dispatch({
                        type: "REMOVE_TEAM_FROM_BYE_SEEDS",
                        teamId: drag.teamId,
                        editable,
                      });
                    }
                    setDrag(null);
                  }
                }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-900">
                  Sitting out (Round 1 bye)
                </p>
                <p className="mt-1 text-[11px] text-sky-900/80">
                  Teams waiting until a later round — not the yellow structural BYE walkover chip.
                </p>
                <div className="mt-2 flex min-h-[48px] flex-wrap gap-1.5">
                  {bankTeams.length === 0 ? (
                    <p className="text-xs text-sky-800/70">All teams are in Round 1 seats</p>
                  ) : (
                    bankTeams.map((t) => (
                      <BankChip
                        key={t.id}
                        label={t.name}
                        selected={selection?.kind === "team" && selection.teamId === t.id}
                        onDragStart={() => setDrag({ type: "team", teamId: t.id })}
                        onDragEnd={() => setDrag(null)}
                        onActivate={() => toggleTeamSelection(t.id)}
                      />
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
                    <BankChip
                      key={t.id}
                      label={t.name}
                      selected={selection?.kind === "team" && selection.teamId === t.id}
                      onDragStart={() => setDrag({ type: "team", teamId: t.id })}
                      onDragEnd={() => setDrag(null)}
                      onActivate={() => toggleTeamSelection(t.id)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/80 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                BYE chip (structural walkover)
              </p>
              <button
                type="button"
                draggable
                onDragStart={() => setDrag({ type: "bye" })}
                onDragEnd={() => setDrag(null)}
                onClick={toggleByeSelection}
                aria-pressed={selection?.kind === "bye"}
                className={
                  "mt-2 inline-flex min-h-10 cursor-grab items-center rounded-md border px-3 py-2 text-sm font-semibold active:cursor-grabbing " +
                  (selection?.kind === "bye"
                    ? "border-amber-500 bg-amber-100 text-amber-950 ring-2 ring-amber-400"
                    : "border-amber-300 bg-white text-amber-950")
                }
              >
                BYE
              </button>
              <p className="mt-2 text-[11px] leading-snug text-amber-900/80">
                Place on an Away/Home seat only for a walkover. Mid-round bye seeds use the slots
                above for top seeds sitting out Round 1.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BankChip({
  label,
  selected,
  onDragStart,
  onDragEnd,
  onActivate,
}: {
  label: string;
  selected: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onActivate: () => void;
}) {
  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate();
        }
      }}
      aria-pressed={selected}
      className={
        "inline-flex min-h-10 cursor-grab items-center rounded-md border px-3 py-2 text-sm font-medium active:cursor-grabbing " +
        (selected
          ? "border-emerald-500 bg-emerald-100 text-emerald-950 ring-2 ring-emerald-400"
          : "border-sky-300 bg-white text-sky-950")
      }
    >
      {label}
    </button>
  );
}

function DropSeat({
  label,
  side,
  disabled,
  selectedTarget,
  onDragOver,
  onDrop,
  onDragStartChip,
  onDragEndChip,
  onClear,
  onActivateSeat,
  onChipKeyDown,
}: {
  label: string;
  side: SeedBoardSide;
  disabled: boolean;
  selectedTarget: boolean;
  onDragOver: (e: DragEvent) => void;
  onDrop: () => void;
  onDragStartChip: () => void;
  onDragEndChip: () => void;
  onClear: () => void;
  onActivateSeat: () => void;
  onChipKeyDown: (e: KeyboardEvent) => void;
}) {
  const kindLabel =
    side.kind === "empty" ? "empty" : side.kind === "bye" ? "structural BYE" : "team";

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`${label} seat (${kindLabel})`}
      onDragOver={disabled ? undefined : onDragOver}
      onDrop={disabled ? undefined : onDrop}
      onClick={disabled ? undefined : onActivateSeat}
      onKeyDown={
        disabled
          ? undefined
          : (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onActivateSeat();
              }
            }
      }
      className={
        "min-h-[52px] rounded-md border px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 " +
        (selectedTarget && !disabled
          ? "border-emerald-400 bg-emerald-50/80 ring-1 ring-emerald-200"
          : "border-zinc-200 bg-zinc-50/80")
      }
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <div className="mt-1">
        {side.kind === "empty" ? (
          <p className="text-xs text-zinc-400">
            {selectedTarget ? "Tap to place" : "Empty — drop team or BYE"}
          </p>
        ) : (
          <button
            type="button"
            draggable={!disabled}
            disabled={disabled}
            onDragStart={disabled ? undefined : onDragStartChip}
            onDragEnd={disabled ? undefined : onDragEndChip}
            onClick={
              disabled
                ? undefined
                : (e) => {
                    e.stopPropagation();
                    if (selectedTarget) onActivateSeat();
                    else onClear();
                  }
            }
            onKeyDown={disabled ? undefined : onChipKeyDown}
            title={
              disabled
                ? undefined
                : selectedTarget
                  ? "Place or swap selection here"
                  : "Click to remove · drag or select to move"
            }
            className={
              side.kind === "bye"
                ? "inline-flex min-h-10 cursor-grab items-center rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950 disabled:cursor-default"
                : "inline-flex min-h-10 cursor-grab items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 disabled:cursor-default"
            }
          >
            {side.kind === "bye" ? "BYE" : side.name}
          </button>
        )}
      </div>
    </div>
  );
}
