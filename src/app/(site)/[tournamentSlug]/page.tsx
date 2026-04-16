import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { AnnouncementList } from "@/components/announcements/AnnouncementList";
import { UpcomingGamesWithDivisionTabs } from "@/components/schedule/UpcomingGamesWithDivisionTabs";
import { WeatherSection } from "@/components/weather/WeatherSection";
import { buildDivisionTabDescriptors } from "@/lib/division-tabs";
import {
  defaultDivisionTabId,
  divisionValidIdsWithAll,
  resolveDivisionTabForFilters,
} from "@/lib/division-tab-utils";
import { listAnnouncements } from "@/lib/services/announcements";
import { listUpcomingGamesForHome } from "@/lib/services/games";
import { listPoolsForDivisionTabs } from "@/lib/services/pools";
import { getPublishedTournamentBySlug } from "@/lib/tournament-context";
import { tournamentPath } from "@/lib/tournament-public-path";

function QuickLinkCard({ href, label, description, icon }: { href: string; label: string; description: string; icon: ReactNode }) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-zinc-200 bg-white p-4 text-center shadow-sm transition-all hover:border-royal-200 hover:shadow-md active:scale-[0.98]"
    >
      {icon}
      <span className="text-sm font-semibold text-zinc-900">{label}</span>
      <span className="text-[11px] text-zinc-500">{description}</span>
    </Link>
  );
}

export default async function TournamentHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ tournamentSlug: string }>;
  searchParams: Promise<{ division?: string }>;
}) {
  const { tournamentSlug } = await params;
  const sp = await searchParams;
  const tournament = await getPublishedTournamentBySlug(tournamentSlug);
  if (!tournament) {
    return null;
  }

  const [announcements, upcomingGames, poolsForTabs] = await Promise.all([
    listAnnouncements(tournament.id),
    listUpcomingGamesForHome(tournament.id),
    listPoolsForDivisionTabs(tournament.id),
  ]);

  const divisionDescriptors = buildDivisionTabDescriptors(poolsForTabs);
  const validDivisionIds = divisionValidIdsWithAll(divisionDescriptors);
  const resolvedDivisionId = resolveDivisionTabForFilters(
    sp.division,
    validDivisionIds,
    defaultDivisionTabId(divisionDescriptors),
  );

  const tp = (s: string) => tournamentPath(tournamentSlug, s);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{tournament.name}</h1>
        <p className="text-sm text-zinc-600">
          {tournament.shortLabel ? `${tournament.shortLabel} · ` : ""}
          {tournament.locationLabel}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <WeatherSection tournamentId={tournament.id} />
        <div className="grid grid-cols-2 gap-3">
          <QuickLinkCard href={tp("schedule")} label="Schedule & Results" description="Times, fields & scores" icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-7 text-accent"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
          } />
          <QuickLinkCard href={tp("standings")} label="Standings" description="Pool rankings" icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-7 text-royal-light"><path d="M8 21V16M12 21V10M16 21V4" /></svg>
          } />
          <QuickLinkCard href={tp("brackets")} label="Brackets" description="Playoff rounds" icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-7 text-accent"><path d="M4 4v6h4M4 7h4M20 4v6h-4M20 7h-4M4 20v-6h4M4 17h4M20 20v-6h-4M20 17h-4M8 7h2a2 2 0 012 2v6a2 2 0 01-2 2H8M16 7h-2a2 2 0 00-2 2v6a2 2 0 002 2h2" /></svg>
          } />
          <QuickLinkCard href={tp("locations")} label="Locations" description="Venues & maps" icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-7 text-royal-light"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /><circle cx="12" cy="9" r="2.5" /></svg>
          } />
        </div>
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
            <UpcomingGamesWithDivisionTabs
              tournamentSlug={tournamentSlug}
              poolsForTabs={poolsForTabs}
              games={upcomingGames}
              initialResolvedDivisionId={resolvedDivisionId}
              timezone={tournament.timezone}
            />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
