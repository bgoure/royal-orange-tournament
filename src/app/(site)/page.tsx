import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { UpcomingGamesWithDivisionTabs } from "@/components/schedule/UpcomingGamesWithDivisionTabs";
import { WeatherSection } from "@/components/weather/WeatherSection";
import { buildDivisionTabDescriptors } from "@/lib/division-tabs";
import {
  divisionValidIdsWithAll,
  getDivisionTabCookie,
  resolveDivisionTabForFilters,
} from "@/lib/division-tab-cookie";
import { listAnnouncements } from "@/lib/services/announcements";
import { listUpcomingGamesForHome } from "@/lib/services/games";
import { listPoolsForDivisionTabs } from "@/lib/services/pools";
import { getTournamentForRequest } from "@/lib/tournament-context";

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

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ division?: string }>;
}) {
  const tournament = await getTournamentForRequest();
  const sp = await searchParams;

  if (!tournament) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center">
        <h1 className="text-xl font-semibold text-zinc-900">No published tournaments</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Seed the database or publish a tournament in the admin portal.
        </p>
      </div>
    );
  }

  const [announcements, upcomingGames, poolsForTabs, cookieDivision] = await Promise.all([
    listAnnouncements(tournament.id),
    listUpcomingGamesForHome(tournament.id),
    listPoolsForDivisionTabs(tournament.id),
    getDivisionTabCookie(),
  ]);

  const divisionDescriptors = buildDivisionTabDescriptors(poolsForTabs);
  const validDivisionIds = divisionValidIdsWithAll(divisionDescriptors);
  const resolvedDivisionId = resolveDivisionTabForFilters(sp.division, cookieDivision, validDivisionIds);

  const latestAnnouncement = announcements.length > 0 ? announcements[0] : null;
  const hasMoreAnnouncements = announcements.length > 1;

  return (
    <div className="flex flex-col gap-4">
      {/* Bento grid: weather + quick links */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <WeatherSection tournamentId={tournament.id} />
        <div className="grid grid-cols-2 gap-3">
          <QuickLinkCard href="/schedule" label="Schedule" description="Game times & fields" icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-7 text-accent"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
          } />
          <QuickLinkCard href="/standings" label="Standings" description="Pool rankings" icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-7 text-royal-light"><path d="M8 21V16M12 21V10M16 21V4" /></svg>
          } />
          <QuickLinkCard href="/brackets" label="Brackets" description="Playoff rounds" icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-7 text-accent"><path d="M4 4v6h4M4 7h4M20 4v6h-4M20 7h-4M4 20v-6h4M4 17h4M20 20v-6h-4M20 17h-4M8 7h2a2 2 0 012 2v6a2 2 0 01-2 2H8M16 7h-2a2 2 0 00-2 2v6a2 2 0 002 2h2" /></svg>
          } />
          <QuickLinkCard href="/locations" label="Locations" description="Venues & maps" icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-7 text-royal-light"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /><circle cx="12" cy="9" r="2.5" /></svg>
          } />
        </div>
      </div>

      {/* Latest announcement — only shown when there is one */}
      {latestAnnouncement ? (
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Announcement</h2>
            {hasMoreAnnouncements ? (
              <Link href="/announcements" className="text-xs font-medium text-royal-light hover:underline">
                See all
              </Link>
            ) : null}
          </div>
          <div className="mt-2">
            <div
              className={`rounded-2xl border px-4 py-3 ${
                latestAnnouncement.priority
                  ? "border-amber-200 bg-amber-50/80"
                  : "border-zinc-200 bg-white shadow-sm"
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold text-zinc-900">{latestAnnouncement.title}</h3>
                <time className="text-[10px] text-zinc-400" dateTime={latestAnnouncement.publishedAt.toISOString()}>
                  {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(latestAnnouncement.publishedAt)}
                </time>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">{latestAnnouncement.body}</p>
            </div>
          </div>
        </section>
      ) : null}

      {/* Upcoming games */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Upcoming games</h2>
        <p className="mt-1 text-xs text-zinc-500">Times shown in your local timezone.</p>
        <div className="mt-3">
          <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-zinc-100" aria-hidden />}>
            <UpcomingGamesWithDivisionTabs
              poolsForTabs={poolsForTabs}
              games={upcomingGames}
              initialResolvedDivisionId={resolvedDivisionId}
            />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
