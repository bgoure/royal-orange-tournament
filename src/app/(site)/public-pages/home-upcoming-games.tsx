"use client";

import { useMemo } from "react";
import { UpcomingGamesWithDivisionTabs } from "@/components/schedule/UpcomingGamesWithDivisionTabs";
import type { GameWithTeams } from "@/components/schedule/GameList";
import { SectionTitle } from "@/components/ui/PublicHeading";
import { useFavorites } from "@/hooks/useFavorites";

export function HomeUpcomingGamesSection({
  tournamentId,
  divisionTabId,
  games,
  timezone,
}: {
  tournamentId: string;
  divisionTabId: string | undefined;
  games: GameWithTeams[];
  timezone: string;
}) {
  const { isLoaded, getFavoriteTeamIdForDivision, tournamentId: ctxId } = useFavorites();
  const myTeamId = divisionTabId ? getFavoriteTeamIdForDivision(divisionTabId) : undefined;

  const filtered = useMemo(() => {
    if (!isLoaded || !myTeamId) return games;
    return games.filter((g) => g.homeTeamId !== myTeamId && g.awayTeamId !== myTeamId);
  }, [games, myTeamId, isLoaded]);

  const showOtherLabel = Boolean(isLoaded && myTeamId);
  const title = showOtherLabel ? "Other Upcoming Games" : "Upcoming games";

  if (ctxId !== tournamentId) {
    return (
      <section>
        <SectionTitle className="mb-3">Upcoming games</SectionTitle>
        <div>
          <UpcomingGamesWithDivisionTabs
            games={games}
            calendarTimezone={timezone}
            tournamentId={tournamentId}
          />
        </div>
      </section>
    );
  }

  return (
    <section>
      <SectionTitle className="mb-3">{title}</SectionTitle>
      <div>
        <UpcomingGamesWithDivisionTabs
          games={filtered}
          calendarTimezone={timezone}
          tournamentId={tournamentId}
          emptyMessage={
            showOtherLabel
              ? "No other upcoming games in this division."
              : undefined
          }
          emptyHint={
            showOtherLabel ? "Your team’s games are listed under My Team." : undefined
          }
        />
      </div>
    </section>
  );
}
