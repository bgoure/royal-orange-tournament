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
  divisionTabId: string | undefined;
  timezone?: string;
}) {
  const { isLoaded, getFavoriteTeamIdForDivision, tournamentId: ctxId } = useFavorites();
  const [games, setGames] = useState<GameWithTeams[]>([]);
  const [fetchDone, setFetchDone] = useState(false);

  const myTeamId = divisionTabId ? getFavoriteTeamIdForDivision(divisionTabId) : undefined;

  useEffect(() => {
    if (ctxId !== tournamentId) {
      setGames([]);
      setFetchDone(true);
      return;
    }
    if (!isLoaded || !myTeamId) {
      setGames([]);
      setFetchDone(true);
      return;
    }

    let cancelled = false;
    setFetchDone(false);

    void (async () => {
      try {
        const rows = await fetchGamesForFavoriteTeams(tournamentId, divisionTabId ?? null, [myTeamId]);
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
  }, [isLoaded, tournamentId, divisionTabId, myTeamId, ctxId]);

  if (ctxId !== tournamentId) return null;
  if (!isLoaded || !fetchDone || !myTeamId) {
    return null;
  }

  return (
    <section aria-label="My Team">
      <SectionTitle className="mb-3">My Team</SectionTitle>
      <GameList
        games={games}
        timezone={timezone}
        displayTimesInViewerTimezone
        horizontal
        animateStagger
        scheduleCompactLayout
        tournamentId={tournamentId}
        glassVariant
        emptyMessage="No games for My Team in this division yet."
        emptyHint="Games appear here for the team you follow in this division."
      />
    </section>
  );
}
