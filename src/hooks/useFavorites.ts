"use client";

import { useCallback, useEffect, useState } from "react";

function storageKey(tournamentId: string): string {
  return `tourney-favorites-${tournamentId}`;
}

export function useFavorites(tournamentId: string) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      if (cancelled) return;
      if (!tournamentId) {
        setIsLoaded(true);
        return;
      }
      try {
        const raw = localStorage.getItem(storageKey(tournamentId));
        if (raw) {
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed)) {
            setFavorites(parsed.filter((x): x is string => typeof x === "string" && x.length > 0));
          }
        }
      } catch {
        /* ignore corrupt storage */
      }
      if (!cancelled) setIsLoaded(true);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [tournamentId]);

  const toggleFavorite = useCallback(
    (teamId: string) => {
      const id = teamId.trim();
      if (!id || !tournamentId) return;

      setFavorites((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        try {
          localStorage.setItem(storageKey(tournamentId), JSON.stringify(next));
        } catch {
          /* quota or private mode */
        }
        return next;
      });
    },
    [tournamentId],
  );

  return { favorites, toggleFavorite, isLoaded };
}
