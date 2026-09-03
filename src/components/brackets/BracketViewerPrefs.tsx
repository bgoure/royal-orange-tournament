"use client";

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  DEFAULT_BRACKET_DISPLAY_PREFS,
  readBracketDisplayPrefs,
  writeBracketDisplayPrefs,
  type BracketDisplayPrefs,
} from "@/lib/brackets/bracket-viewer-prefs";

// The prefs cookie is an external store: keeping it outside React lets the first
// client render already use the saved value, while SSR/hydration uses the defaults.
const prefsListeners = new Set<() => void>();
let prefsSnapshot: BracketDisplayPrefs | null = null;

function subscribeToPrefs(listener: () => void) {
  prefsListeners.add(listener);
  return () => {
    prefsListeners.delete(listener);
  };
}

function getPrefsSnapshot(): BracketDisplayPrefs {
  prefsSnapshot ??= readBracketDisplayPrefs();
  return prefsSnapshot;
}

function getPrefsServerSnapshot(): BracketDisplayPrefs {
  return DEFAULT_BRACKET_DISPLAY_PREFS;
}

function publishPrefs(next: BracketDisplayPrefs) {
  prefsSnapshot = next;
  writeBracketDisplayPrefs(next);
  for (const listener of [...prefsListeners]) listener();
}

const BracketViewerPrefsContext = createContext<{
  prefs: BracketDisplayPrefs;
  setPrefs: (next: BracketDisplayPrefs) => void;
}>({
  prefs: DEFAULT_BRACKET_DISPLAY_PREFS,
  setPrefs: () => {},
});

export function useBracketDisplayPrefs(): BracketDisplayPrefs {
  return useContext(BracketViewerPrefsContext).prefs;
}

export function BracketViewerPrefsProvider({ children }: { children: ReactNode }) {
  const prefs = useSyncExternalStore(
    subscribeToPrefs,
    getPrefsSnapshot,
    getPrefsServerSnapshot,
  );

  const setPrefs = useCallback((next: BracketDisplayPrefs) => {
    publishPrefs(next);
  }, []);

  return (
    <BracketViewerPrefsContext.Provider value={{ prefs, setPrefs }}>
      {children}
    </BracketViewerPrefsContext.Provider>
  );
}

function FilterChip({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      title={hint}
      className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold shadow-sm ${
        checked
          ? "border-royal/40 bg-royal-50 text-royal"
          : "border-zinc-300 bg-white text-zinc-500"
      }`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3.5 rounded border-zinc-300 text-royal focus:ring-royal"
      />
      {label}
    </label>
  );
}

export function BracketDisplayFilters() {
  const uid = useId();
  const { prefs, setPrefs } = useContext(BracketViewerPrefsContext);
  const patch = (partial: Partial<BracketDisplayPrefs>) => setPrefs({ ...prefs, ...partial });

  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-1.5"
      role="group"
      aria-label="Bracket card display options"
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Show</span>
      <FilterChip
        id={`${uid}-datetime`}
        label="Date / time"
        checked={prefs.showDateTime}
        onChange={(showDateTime) => patch({ showDateTime })}
      />
      <FilterChip
        id={`${uid}-names`}
        label="Team names"
        hint="Off = logos only"
        checked={prefs.showTeamNames}
        onChange={(showTeamNames) => patch({ showTeamNames })}
      />
      <FilterChip
        id={`${uid}-location`}
        label="Location"
        checked={prefs.showLocation}
        onChange={(showLocation) => patch({ showLocation })}
      />
      <FilterChip
        id={`${uid}-gnum`}
        label="Game number"
        checked={prefs.showGameNumber}
        onChange={(showGameNumber) => patch({ showGameNumber })}
      />
    </div>
  );
}
