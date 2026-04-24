"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_MAP_KEY = (tournamentId: string) => `tourney-my-team-${tournamentId}`;
const STORAGE_SILENT_KEY = (tournamentId: string) => `tourney-my-team-switch-silent-${tournamentId}`;

export type FavoriteSwitchPending = {
  divisionId: string;
  newTeamId: string;
  newTeamDisplayName: string;
  previousTeamId: string;
};

type FavoritesContextValue = {
  tournamentId: string;
  isLoaded: boolean;
  favoriteByDivision: Readonly<Record<string, string>>;
  getFavoriteTeamIdForDivision: (divisionId: string | undefined) => string | undefined;
  favoriteTeamIds: string[];
  toggleFavorite: (teamId: string, divisionId: string | undefined, newTeamDisplayName?: string) => void;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

function loadSilentPreference(tournamentId: string): boolean {
  try {
    return localStorage.getItem(STORAGE_SILENT_KEY(tournamentId)) === "1";
  } catch {
    return false;
  }
}

function persistSilentPreference(tournamentId: string) {
  try {
    localStorage.setItem(STORAGE_SILENT_KEY(tournamentId), "1");
  } catch {
    /* ignore */
  }
}

function loadMap(tournamentId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_MAP_KEY(tournamentId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof k === "string" && k.length > 0 && typeof v === "string" && v.length > 0) {
        out[k] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function persistMap(tournamentId: string, map: Record<string, string>) {
  try {
    localStorage.setItem(STORAGE_MAP_KEY(tournamentId), JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function FavoritesProvider({
  tournamentId,
  children,
}: {
  tournamentId: string;
  children: ReactNode;
}) {
  const [favoriteByDivision, setFavoriteByDivision] = useState<Record<string, string>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<FavoriteSwitchPending | null>(null);
  const [dontAskAgain, setDontAskAgain] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      if (cancelled) return;
      if (!tournamentId) {
        setIsLoaded(true);
        return;
      }
      setFavoriteByDivision(loadMap(tournamentId));
      if (!cancelled) setIsLoaded(true);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [tournamentId]);

  const getFavoriteTeamIdForDivision = useCallback(
    (divisionId: string | undefined) => {
      if (!divisionId) return undefined;
      return favoriteByDivision[divisionId];
    },
    [favoriteByDivision],
  );

  const favoriteTeamIds = useMemo(() => Object.values(favoriteByDivision), [favoriteByDivision]);

  const toggleFavorite = useCallback(
    (teamId: string, divisionId: string | undefined, newTeamDisplayName?: string) => {
      const id = teamId.trim();
      const div = divisionId?.trim();
      if (!id || !div || !tournamentId) return;

      const displayName = (newTeamDisplayName && newTeamDisplayName.trim()) || "this team";

      setFavoriteByDivision((prev) => {
        const cur = prev[div];
        if (cur === id) {
          const next = { ...prev };
          delete next[div];
          persistMap(tournamentId, next);
          return next;
        }
        if (cur && cur !== id) {
          if (loadSilentPreference(tournamentId)) {
            const next = { ...prev, [div]: id };
            persistMap(tournamentId, next);
            return next;
          }
          requestAnimationFrame(() =>
            setPendingSwitch({
              divisionId: div,
              newTeamId: id,
              newTeamDisplayName: displayName,
              previousTeamId: cur,
            }),
          );
          return prev;
        }
        const next = { ...prev, [div]: id };
        persistMap(tournamentId, next);
        return next;
      });
    },
    [tournamentId],
  );

  const confirmSwitch = useCallback(() => {
    if (!pendingSwitch || !tournamentId) return;
    if (dontAskAgain) persistSilentPreference(tournamentId);
    const { divisionId, newTeamId } = pendingSwitch;
    setFavoriteByDivision((prev) => {
      const next = { ...prev, [divisionId]: newTeamId };
      persistMap(tournamentId, next);
      return next;
    });
    setPendingSwitch(null);
    setDontAskAgain(false);
  }, [pendingSwitch, tournamentId, dontAskAgain]);

  const cancelSwitch = useCallback(() => {
    setPendingSwitch(null);
    setDontAskAgain(false);
  }, []);

  const value = useMemo(
    () =>
      ({
        tournamentId,
        isLoaded,
        favoriteByDivision,
        getFavoriteTeamIdForDivision,
        favoriteTeamIds,
        toggleFavorite,
      }) satisfies FavoritesContextValue,
    [
      tournamentId,
      isLoaded,
      favoriteByDivision,
      getFavoriteTeamIdForDivision,
      favoriteTeamIds,
      toggleFavorite,
    ],
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
      {pendingSwitch ? (
        <FavoriteSwitchModal
          pending={pendingSwitch}
          dontAskAgain={dontAskAgain}
          onDontAskAgainChange={setDontAskAgain}
          onConfirm={confirmSwitch}
          onCancel={cancelSwitch}
        />
      ) : null}
    </FavoritesContext.Provider>
  );
}

function FavoriteSwitchModal({
  pending,
  dontAskAgain,
  onDontAskAgainChange,
  onConfirm,
  onCancel,
}: {
  pending: FavoriteSwitchPending;
  dontAskAgain: boolean;
  onDontAskAgainChange: (v: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        aria-label="Close dialog"
        onClick={onCancel}
      />
      <div
        className="relative m-4 w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-950"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="favorite-switch-title"
      >
        <h2 id="favorite-switch-title" className="text-base font-bold text-zinc-900 dark:text-zinc-100">
          Switch My Team?
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          You already follow another team in this division. Replace it with{" "}
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{pending.newTeamDisplayName}</span>?
        </p>
        <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={dontAskAgain}
            onChange={(e) => onDontAskAgainChange(e.target.checked)}
            className="mt-1 rounded border-zinc-300"
          />
          <span>Don&apos;t ask again when I switch My Team</span>
        </label>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="min-h-10 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="min-h-10 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95"
            onClick={onConfirm}
          >
            Switch team
          </button>
        </div>
      </div>
    </div>
  );
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error("useFavorites must be used within FavoritesProvider");
  }
  return ctx;
}
