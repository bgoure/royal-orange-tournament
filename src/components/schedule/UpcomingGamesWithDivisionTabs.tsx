"use client";

import { GameList, type GameWithTeams } from "@/components/schedule/GameList";

export function UpcomingGamesWithDivisionTabs({
  games,
  calendarTimezone,
  displayTimesInViewerTimezone = true,
  tournamentId,
}: {
  games: GameWithTeams[];
  /** Tournament zone for “Live today” and ordering; wall times can still use viewer local. */
  calendarTimezone: string;
  displayTimesInViewerTimezone?: boolean;
  /** Enables favorite stars on cards when set. */
  tournamentId?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <GameList
        games={games}
        timezone={calendarTimezone}
        displayTimesInViewerTimezone={displayTimesInViewerTimezone}
        emptyMessage="No upcoming games scheduled for this division."
        emptyHint="Check another division or open the full schedule."
        horizontal
        animateStagger
        scheduleCompactLayout
        tournamentId={tournamentId}
      />
    </div>
  );
}
