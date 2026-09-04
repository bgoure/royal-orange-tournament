/**
 * Pure Round-1 seed board movement — testable without React / DnD / Server Actions.
 * Later-round winner/loser feeder seats are intentionally not modeled here (not droppable).
 */

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

export type SlotSide = "home" | "away";

export type DragPayload =
  | { type: "team"; teamId: string; from?: { matchId: string; side: SlotSide } }
  | { type: "bye"; from?: { matchId: string; side: SlotSide } };

export type BoardSnapshot = {
  matches: SeedBoardMatch[];
  byeSeedIds: (string | null)[];
};

export type Selection =
  | { kind: "team"; teamId: string }
  | { kind: "bye" }
  | null;

export type SeedBoardState = BoardSnapshot & {
  undoStack: BoardSnapshot[];
  selection: Selection;
  ackImpact: boolean;
};

export type SeedBoardAction =
  | {
      type: "PLACE_ON";
      matchId: string;
      side: SlotSide;
      payload: DragPayload;
      teamNameById: ReadonlyMap<string, string>;
      editable: boolean;
    }
  | {
      type: "PLACE_BYE_SEED";
      index: number;
      payload: DragPayload;
      teamNameById: ReadonlyMap<string, string>;
      editable: boolean;
    }
  | { type: "CLEAR_SIDE"; matchId: string; side: SlotSide; editable: boolean }
  | { type: "RESET"; baseline: BoardSnapshot }
  | { type: "UNDO" }
  | { type: "TOGGLE_TEAM"; teamId: string; editable: boolean }
  | { type: "TOGGLE_BYE"; editable: boolean }
  | { type: "CLEAR_SELECTION" }
  | { type: "SET_ACK"; value: boolean }
  | { type: "CLEAR_BYE_SEED"; index: number; editable: boolean }
  | { type: "REMOVE_TEAM_FROM_BYE_SEEDS"; teamId: string; editable: boolean };

export function sideToSave(side: SeedBoardSide): { bye: true } | { teamId: string } {
  if (side.kind === "team") return { teamId: side.teamId };
  return { bye: true };
}

export function sidesEqual(a: SeedBoardSide, b: SeedBoardSide): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "team" && b.kind === "team") return a.teamId === b.teamId;
  return true;
}

export function snapshotsEqual(a: BoardSnapshot, b: BoardSnapshot): boolean {
  if (a.byeSeedIds.length !== b.byeSeedIds.length) return false;
  for (let i = 0; i < a.byeSeedIds.length; i++) {
    if (a.byeSeedIds[i] !== b.byeSeedIds[i]) return false;
  }
  if (a.matches.length !== b.matches.length) return false;
  for (let i = 0; i < a.matches.length; i++) {
    const x = a.matches[i]!;
    const y = b.matches[i]!;
    if (x.matchId !== y.matchId) return false;
    if (!sidesEqual(x.home, y.home) || !sidesEqual(x.away, y.away)) return false;
  }
  return true;
}

export function cloneSnapshot(s: BoardSnapshot): BoardSnapshot {
  return {
    matches: s.matches.map((m) => ({ ...m, home: { ...m.home }, away: { ...m.away } })),
    byeSeedIds: [...s.byeSeedIds],
  };
}

export function createBaseline(
  matches: SeedBoardMatch[],
  byeSeedTeamIds: (string | null)[],
): BoardSnapshot {
  return cloneSnapshot({ matches, byeSeedIds: byeSeedTeamIds });
}

export function createInitialSeedBoardState(baseline: BoardSnapshot): SeedBoardState {
  const snap = cloneSnapshot(baseline);
  return {
    matches: snap.matches,
    byeSeedIds: snap.byeSeedIds,
    undoStack: [],
    selection: null,
    ackImpact: false,
  };
}

export function collectPlacedTeamIds(snap: BoardSnapshot): Set<string> {
  const ids = new Set<string>();
  for (const match of snap.matches) {
    if (match.home.kind === "team") ids.add(match.home.teamId);
    if (match.away.kind === "team") ids.add(match.away.teamId);
  }
  for (const id of snap.byeSeedIds) {
    if (id) ids.add(id);
  }
  return ids;
}

export function bankTeams(teams: readonly SeedBoardTeam[], snap: BoardSnapshot): SeedBoardTeam[] {
  const placed = collectPlacedTeamIds(snap);
  return teams.filter((t) => !placed.has(t.id));
}

export function isBoardDirty(current: BoardSnapshot, baseline: BoardSnapshot): boolean {
  return !snapshotsEqual(current, baseline);
}

export function byeSeedsReady(byeSeedCount: number, byeSeedIds: (string | null)[]): boolean {
  if (byeSeedCount === 0) return true;
  return byeSeedIds.length === byeSeedCount && byeSeedIds.every((id) => id != null);
}

/** Serialize pending board into the shape expected by saveBracketRoundZeroSeedingSchema. */
export function toSavePayload(snap: BoardSnapshot): {
  slots: Array<{
    matchId: string;
    home: { bye: true } | { teamId: string };
    away: { bye: true } | { teamId: string };
  }>;
  byeSeedTeamIds: string[];
} {
  return {
    slots: snap.matches.map((m) => ({
      matchId: m.matchId,
      home: sideToSave(m.home),
      away: sideToSave(m.away),
    })),
    byeSeedTeamIds: snap.byeSeedIds.filter((id): id is string => id != null),
  };
}

export function selectionToPayload(
  selection: Selection,
  matches: readonly SeedBoardMatch[],
): DragPayload | null {
  if (!selection) return null;
  if (selection.kind === "bye") return { type: "bye" };
  for (const match of matches) {
    if (match.home.kind === "team" && match.home.teamId === selection.teamId) {
      return {
        type: "team",
        teamId: selection.teamId,
        from: { matchId: match.matchId, side: "home" },
      };
    }
    if (match.away.kind === "team" && match.away.teamId === selection.teamId) {
      return {
        type: "team",
        teamId: selection.teamId,
        from: { matchId: match.matchId, side: "away" },
      };
    }
  }
  return { type: "team", teamId: selection.teamId };
}

function clearTeamFromByeSeeds(byeSeedIds: (string | null)[], teamId: string): (string | null)[] {
  return byeSeedIds.map((id) => (id === teamId ? null : id));
}

function clearTeamFromMatches(matches: SeedBoardMatch[], teamId: string, exceptMatchId?: string): SeedBoardMatch[] {
  return matches.map((m) => {
    if (exceptMatchId && m.matchId === exceptMatchId) return m;
    let home = m.home;
    let away = m.away;
    if (home.kind === "team" && home.teamId === teamId) home = { kind: "empty" };
    if (away.kind === "team" && away.teamId === teamId) away = { kind: "empty" };
    return home === m.home && away === m.away ? m : { ...m, home, away };
  });
}

/** Place a team or BYE on a Round 1 seat. Returns null when the target is locked / missing. */
export function placeOnSnapshot(
  snap: BoardSnapshot,
  matchId: string,
  side: SlotSide,
  payload: DragPayload,
  teamNameById: ReadonlyMap<string, string>,
): BoardSnapshot | null {
  const target = snap.matches.find((m) => m.matchId === matchId);
  if (!target || target.locked) return null;

  let byeSeedIds = snap.byeSeedIds;
  if (payload.type === "team") {
    byeSeedIds = clearTeamFromByeSeeds(byeSeedIds, payload.teamId);
  }

  const incoming: SeedBoardSide =
    payload.type === "bye"
      ? { kind: "bye" }
      : {
          kind: "team",
          teamId: payload.teamId,
          name: teamNameById.get(payload.teamId) ?? "Team",
        };

  const displaced = target[side];
  let matches = snap.matches.map((m) =>
    m.matchId === matchId ? { ...m, [side]: incoming } : m,
  );

  if (payload.from) {
    const { matchId: fromId, side: fromSide } = payload.from;
    if (fromId !== matchId || fromSide !== side) {
      const swapIn: SeedBoardSide = displaced.kind === "empty" ? { kind: "empty" } : displaced;
      matches = matches.map((m) => (m.matchId === fromId ? { ...m, [fromSide]: swapIn } : m));
    }
  } else if (payload.type === "team") {
    matches = clearTeamFromMatches(matches, payload.teamId, matchId);
  }

  return { matches, byeSeedIds };
}

export function placeOnByeSeedSnapshot(
  snap: BoardSnapshot,
  index: number,
  payload: DragPayload,
  teamNameById: ReadonlyMap<string, string>,
): BoardSnapshot | null {
  if (payload.type !== "team") return null;
  if (index < 0 || index >= snap.byeSeedIds.length) return null;

  const nextBye = [...snap.byeSeedIds];
  const displaced = nextBye[index] ?? null;
  for (let i = 0; i < nextBye.length; i++) {
    if (nextBye[i] === payload.teamId) nextBye[i] = null;
  }
  nextBye[index] = payload.teamId;

  let matches = clearTeamFromMatches(snap.matches, payload.teamId);
  if (payload.from && displaced) {
    const { matchId: fromId, side: fromSide } = payload.from;
    matches = matches.map((m) =>
      m.matchId === fromId
        ? {
            ...m,
            [fromSide]: {
              kind: "team" as const,
              teamId: displaced,
              name: teamNameById.get(displaced) ?? "Team",
            },
          }
        : m,
    );
  } else if (payload.from) {
    const { matchId: fromId, side: fromSide } = payload.from;
    matches = matches.map((m) =>
      m.matchId === fromId ? { ...m, [fromSide]: { kind: "empty" as const } } : m,
    );
  }

  return { matches, byeSeedIds: nextBye };
}

export function clearSideSnapshot(
  snap: BoardSnapshot,
  matchId: string,
  side: SlotSide,
): BoardSnapshot | null {
  const target = snap.matches.find((m) => m.matchId === matchId);
  if (!target || target.locked) return null;
  return {
    matches: snap.matches.map((m) =>
      m.matchId === matchId ? { ...m, [side]: { kind: "empty" as const } } : m,
    ),
    byeSeedIds: snap.byeSeedIds,
  };
}

function pushUndo(state: SeedBoardState): SeedBoardState {
  return {
    ...state,
    undoStack: [...state.undoStack.slice(-19), cloneSnapshot(state)],
  };
}

export function seedBoardReducer(state: SeedBoardState, action: SeedBoardAction): SeedBoardState {
  switch (action.type) {
    case "PLACE_ON": {
      if (!action.editable) return state;
      const next = placeOnSnapshot(
        state,
        action.matchId,
        action.side,
        action.payload,
        action.teamNameById,
      );
      if (!next) return state;
      const withUndo = pushUndo(state);
      return {
        ...withUndo,
        matches: next.matches,
        byeSeedIds: next.byeSeedIds,
        selection: null,
        ackImpact: false,
      };
    }
    case "PLACE_BYE_SEED": {
      if (!action.editable) return state;
      const next = placeOnByeSeedSnapshot(
        state,
        action.index,
        action.payload,
        action.teamNameById,
      );
      if (!next) return state;
      const withUndo = pushUndo(state);
      return {
        ...withUndo,
        matches: next.matches,
        byeSeedIds: next.byeSeedIds,
        selection: null,
        ackImpact: false,
      };
    }
    case "CLEAR_SIDE": {
      if (!action.editable) return state;
      const next = clearSideSnapshot(state, action.matchId, action.side);
      if (!next) return state;
      const withUndo = pushUndo(state);
      return {
        ...withUndo,
        matches: next.matches,
        byeSeedIds: next.byeSeedIds,
        ackImpact: false,
      };
    }
    case "RESET": {
      const snap = cloneSnapshot(action.baseline);
      return {
        matches: snap.matches,
        byeSeedIds: snap.byeSeedIds,
        undoStack: [],
        selection: null,
        ackImpact: false,
      };
    }
    case "UNDO": {
      if (state.undoStack.length === 0) return state;
      const prev = state.undoStack[state.undoStack.length - 1]!;
      const changed = !snapshotsEqual(state, prev);
      return {
        matches: prev.matches,
        byeSeedIds: prev.byeSeedIds,
        undoStack: state.undoStack.slice(0, -1),
        selection: null,
        ackImpact: changed ? false : state.ackImpact,
      };
    }
    case "TOGGLE_TEAM": {
      if (!action.editable) return state;
      const cur = state.selection;
      return {
        ...state,
        selection:
          cur?.kind === "team" && cur.teamId === action.teamId
            ? null
            : { kind: "team", teamId: action.teamId },
      };
    }
    case "TOGGLE_BYE": {
      if (!action.editable) return state;
      return {
        ...state,
        selection: state.selection?.kind === "bye" ? null : { kind: "bye" },
      };
    }
    case "CLEAR_SELECTION":
      return { ...state, selection: null };
    case "SET_ACK":
      return { ...state, ackImpact: action.value };
    case "CLEAR_BYE_SEED": {
      if (!action.editable) return state;
      if (action.index < 0 || action.index >= state.byeSeedIds.length) return state;
      if (state.byeSeedIds[action.index] == null) return state;
      const withUndo = pushUndo(state);
      return {
        ...withUndo,
        byeSeedIds: state.byeSeedIds.map((id, i) => (i === action.index ? null : id)),
        ackImpact: false,
      };
    }
    case "REMOVE_TEAM_FROM_BYE_SEEDS": {
      if (!action.editable) return state;
      if (!state.byeSeedIds.includes(action.teamId)) return state;
      const withUndo = pushUndo(state);
      return {
        ...withUndo,
        byeSeedIds: clearTeamFromByeSeeds(state.byeSeedIds, action.teamId),
        ackImpact: false,
      };
    }
    default:
      return state;
  }
}
