"use client";

import { createContext, useCallback, useContext, useEffect, useId, useState, type ReactNode } from "react";
import {
  DEFAULT_BRACKET_DISPLAY_PREFS,
  readBracketDisplayPrefs,
  writeBracketDisplayPrefs,
  type BracketDisplayPrefs,
} from "@/lib/brackets/bracket-viewer-prefs";

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
  const [prefs, setPrefsState] = useState<BracketDisplayPrefs>(DEFAULT_BRACKET_DISPLAY_PREFS);

  useEffect(() => {
    setPrefsState(readBracketDisplayPrefs());
  }, []);

  const setPrefs = useCallback((next: BracketDisplayPrefs) => {
    setPrefsState(next);
    writeBracketDisplayPrefs(next);
  }, []);

  return (
    <BracketViewerPrefsContext.Provider value={{ prefs, setPrefs }}>
      {children}
    </BracketViewerPrefsContext.Provider>
  );
}

function FilterToggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded border-zinc-300 text-royal focus:ring-royal"
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
    <details className="relative">
      <summary className="inline-flex min-h-9 cursor-pointer list-none items-center rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 [&::-webkit-details-marker]:hidden">
        Display
      </summary>
      <div className="absolute left-0 z-40 mt-1 w-56 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Show on cards
        </p>
        <div className="flex flex-col gap-2">
          <FilterToggle
            id={`${uid}-datetime`}
            label="Date / time"
            checked={prefs.showDateTime}
            onChange={(showDateTime) => patch({ showDateTime })}
          />
          <FilterToggle
            id={`${uid}-names`}
            label="Team names"
            checked={prefs.showTeamNames}
            onChange={(showTeamNames) => patch({ showTeamNames })}
          />
          <p className="-mt-1 pl-6 text-[11px] text-zinc-500">Off = logos only</p>
          <FilterToggle
            id={`${uid}-location`}
            label="Location"
            checked={prefs.showLocation}
            onChange={(showLocation) => patch({ showLocation })}
          />
          <FilterToggle
            id={`${uid}-gnum`}
            label="Game number"
            checked={prefs.showGameNumber}
            onChange={(showGameNumber) => patch({ showGameNumber })}
          />
        </div>
      </div>
    </details>
  );
}
