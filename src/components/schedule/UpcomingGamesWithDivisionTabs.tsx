"use client";

import { GameList, type GameWithTeams } from "@/components/schedule/GameList";

export function UpcomingGamesWithDivisionTabs({
  games,
  timezone,
}: {
  games: GameWithTeams[];
  timezone: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <GameList
        games={games}
        timezone={timezone}
        emptyMessage="No upcoming games scheduled for this division."
        emptyHint="Check another division or open the full schedule."
        horizontal
      />
    </div>
  );
}
