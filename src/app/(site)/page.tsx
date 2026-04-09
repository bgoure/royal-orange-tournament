import { Suspense } from "react";
import { AnnouncementList } from "@/components/announcements/AnnouncementList";
import { UpcomingGamesWithDivisionTabs } from "@/components/schedule/UpcomingGamesWithDivisionTabs";
import { WeatherSection } from "@/components/weather/WeatherSection";
import { listAnnouncements } from "@/lib/services/announcements";
import { listUpcomingGamesForHome } from "@/lib/services/games";
import { listPoolsForDivisionTabs } from "@/lib/services/pools";
import { getTournamentForRequest } from "@/lib/tournament-context";

export default async function HomePage() {
  const tournament = await getTournamentForRequest();

  if (!tournament) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center">
        <h1 className="text-xl font-semibold text-zinc-900">No published tournaments</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Seed the database or publish a tournament in the admin portal (coming soon).
        </p>
      </div>
    );
  }

  const [announcements, upcomingGames, poolsForTabs] = await Promise.all([
    listAnnouncements(tournament.id),
    listUpcomingGamesForHome(tournament.id),
    listPoolsForDivisionTabs(tournament.id),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{tournament.name}</h1>
        <p className="text-sm text-zinc-600">
          {tournament.shortLabel ? `${tournament.shortLabel} · ` : ""}
          {tournament.locationLabel}
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Announcements</h2>
        <div className="mt-3">
          <AnnouncementList items={announcements} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Upcoming games</h2>
        <p className="mt-1 text-xs text-zinc-500">Next games on the schedule. Times shown in your local timezone.</p>
        <div className="mt-3">
          <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-zinc-100" aria-hidden />}>
            <UpcomingGamesWithDivisionTabs poolsForTabs={poolsForTabs} games={upcomingGames} />
          </Suspense>
        </div>
      </section>

      <WeatherSection tournamentId={tournament.id} />
    </div>
  );
}
