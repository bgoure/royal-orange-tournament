"use client";

import { useEffect, useState } from "react";
import { fetchGamesForFavoriteTeams } from "@/app/actions/favorite-teams-games";
import { GameList, type GameWithTeams } from "@/components/schedule/GameList";
import { SectionTitle } from "@/components/ui/PublicHeading";
import { useFavorites } from "@/hooks/useFavorites";

export function FavoriteTeamsStrip({
  tournamentId,
  divisionTabId,
  timezone,
}: {
  tournamentId: string;
  /** Active public division tab (pool scope), same as schedule/results. */
  divisionTabId: string | undefined;
  timezone?: string;
}) {
  const { favorites, isLoaded } = useFavorites(tournamentId);
  const [games, setGames] = useState<GameWithTeams[]>([]);
  const [fetchDone, setFetchDone] = useState(false);

  useEffect(() => {
    if (!isLoaded || favorites.length === 0) {
      setGames([]);
      setFetchDone(true);
      return;
    }

    let cancelled = false;
    setFetchDone(false);

    void (async () => {
      try {
        const rows = await fetchGamesForFavoriteTeams(tournamentId, divisionTabId ?? null, favorites);
        if (!cancelled) setGames(rows as GameWithTeams[]);
      } catch {
        if (!cancelled) setGames([]);
      } finally {
        if (!cancelled) setFetchDone(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, tournamentId, divisionTabId, favorites]);

  if (!isLoaded || !fetchDone || favorites.length === 0) {
    return null;
  }

  if (games.length === 0) {
    return null;
  }

  return (
    <section aria-label="Your teams">
      <SectionTitle className="mb-3">Your teams</SectionTitle>
      <GameList
        games={games}
        timezone={timezone}
        displayTimesInViewerTimezone
        horizontal
        animateStagger
        tournamentId={tournamentId}
        glassVariant
        emptyMessage="No games for your teams in this division yet."
        emptyHint="Favorite teams from the schedule; their games appear here (all statuses)."
      />
    </section>
  );
}
