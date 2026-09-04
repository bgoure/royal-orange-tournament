/**
 * Pure session state for EntityEditorSheet remounts.
 * Incrementing `session` on every OPEN_* lets callers key={session} so
 * useActionState starts clean; CLOSE only flips open for exit animation.
 */

export type EntitySheetState = {
  mode: string;
  session: number;
  entityId: string | null;
  open: boolean;
};

export type EntitySheetAction =
  | { type: "OPEN"; mode: string; entityId?: string | null }
  | { type: "CLOSE" }
  | { type: "ENTITY_GONE" };

export function createInitialEntitySheetState(idleMode = "idle"): EntitySheetState {
  return { mode: idleMode, session: 0, entityId: null, open: false };
}

export function entitySheetReducer(
  state: EntitySheetState,
  action: EntitySheetAction,
  idleMode = "idle",
): EntitySheetState {
  switch (action.type) {
    case "OPEN":
      return {
        mode: action.mode,
        session: state.session + 1,
        entityId: action.entityId ?? null,
        open: true,
      };
    case "CLOSE":
      return { ...state, open: false };
    case "ENTITY_GONE":
      return { ...state, open: false, mode: idleMode, entityId: null };
    default:
      return state;
  }
}

export function resolveEntityById<T extends { id: string }>(
  items: readonly T[],
  entityId: string | null,
): T | null {
  if (!entityId) return null;
  return items.find((item) => item.id === entityId) ?? null;
}
