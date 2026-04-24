"use client";

import { GameList, type GameWithTeams } from "@/components/schedule/GameList";
import { SectionTitle } from "@/components/ui/PublicHeading";
import { useFavorites } from "@/hooks/useFavorites";

const UPCOMING_FOR_FAVORITES = new Set<string>(["SCHEDULED", "LIVE", "POSTPONED"]);

export function FavoriteTeamsStrip({
  tournamentId,
  games,
  timezone,
}: {
  tournamentId: string;
  games: GameWithTeams[];
  timezone?: string;
}) {
  const { favorites, isLoaded } = useFavorites(tournamentId);

  if (!isLoaded || favorites.length === 0) {
    return null;
  }

  const favSet = new Set(favorites);
  const filteredGames = games.filter(
    (g) =>
      UPCOMING_FOR_FAVORITES.has(g.status) &&
      ((g.homeTeamId != null && favSet.has(g.homeTeamId)) || (g.awayTeamId != null && favSet.has(g.awayTeamId))),
  );

  if (filteredGames.length === 0) {
    return null;
  }

  return (
    <section aria-label="Your teams">
      <SectionTitle className="mb-3">Your teams</SectionTitle>
      <GameList
        games={filteredGames}
        timezone={timezone}
        displayTimesInViewerTimezone
        horizontal
        animateStagger
        tournamentId={tournamentId}
        glassVariant
        emptyMessage="No upcoming games for your teams."
        emptyHint="Favorite teams from the schedule or upcoming list."
      />
    </section>
  );
}
