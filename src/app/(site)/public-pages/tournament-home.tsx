import type { ReactNode } from "react";
import Link from "next/link";
import type { Tournament } from "@prisma/client";
import { AnnouncementList } from "@/components/announcements/AnnouncementList";
import { DivisionSwipeBoundary } from "@/components/layout/DivisionSwipeBoundary";
import { FavoriteTeamsStrip } from "@/components/schedule/FavoriteTeamsStrip";
import { GameList } from "@/components/schedule/GameList";
import { UpcomingGamesWithDivisionTabs } from "@/components/schedule/UpcomingGamesWithDivisionTabs";
import { ChampionCelebration } from "@/components/brackets/ChampionCelebration";
import { SponsorMarquee } from "@/components/sponsors/SponsorMarquee";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { SectionTitle } from "@/components/ui/PublicHeading";
import { WeatherSection } from "@/components/weather/WeatherSection";
import { getDivisionTabCookie } from "@/lib/division-tab-cookie";
import { buildDivisionTabDescriptors } from "@/lib/division-tabs";
import {
  defaultDivisionTabId,
  divisionValidIds,
  resolveDivisionTabForFilters,
} from "@/lib/division-tab-utils";
import { listLatestAnnouncementForHome } from "@/lib/services/announcements";
import { formatHeadquartersHomeLabel } from "@/lib/headquarters-display";
import { getHeadquartersLocation } from "@/lib/services/content";
import { listRecentGamesForHome, listUpcomingGamesForHome } from "@/lib/services/games";
import { getBracketChampionForDivisionTab } from "@/lib/brackets/bracket-champion";
import { listPoolsForDivisionTabs } from "@/lib/services/pools";
import { tournamentPathFromBase, tournamentPublicBasePath } from "@/lib/tournament-public-path";

function QuickLinkCard({
  href,
  label,
  description,
  icon,
}: {
  href: string;
  label: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-[48px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-zinc-200 border-l-2 border-l-royal/90 bg-white p-4 text-center shadow-sm transition-all hover:border-royal-200 hover:shadow-md active:scale-[0.98]"
    >
      <span className="text-royal [&_svg]:text-royal">{icon}</span>
      <span className="text-sm font-semibold text-zinc-900 group-hover:text-accent">{label}</span>
      <span className="text-[11px] text-zinc-500">{description}</span>
    </Link>
  );
}

export async function TournamentHomePublic({
  tournament,
  searchParams,
}: {
  tournament: Tournament;
  searchParams: { division?: string };
}) {
  const publicBasePath = tournamentPublicBasePath(tournament);
  const tp = (s: string) => tournamentPathFromBase(publicBasePath, s);

  const poolsForTabs = await listPoolsForDivisionTabs(tournament.id);

  const divisionDescriptors = buildDivisionTabDescriptors(poolsForTabs);
  const cookieDivision = await getDivisionTabCookie();
  const validDivisionIds = divisionValidIds(divisionDescriptors);
  const resolvedDivisionId = resolveDivisionTabForFilters(
    searchParams.division,
    cookieDivision,
    validDivisionIds,
    defaultDivisionTabId(divisionDescriptors),
  );

  const showPublicAnnouncements = tournament.showPublicAnnouncements;
  const [latestAnnouncement, upcomingGames, recentGames, hq, champion] = await Promise.all([
    showPublicAnnouncements ? listLatestAnnouncementForHome(tournament.id) : Promise.resolve(null),
    listUpcomingGamesForHome(tournament.id, resolvedDivisionId || undefined),
    listRecentGamesForHome(tournament.id, resolvedDivisionId || undefined),
    getHeadquartersLocation(tournament.id),
    getBracketChampionForDivisionTab(tournament.id, resolvedDivisionId, poolsForTabs),
  ]);

  const hqWeatherBlock = (
    <div className="flex flex-col gap-3">
      {hq ? (
        <p className="text-sm font-semibold text-accent">
          {formatHeadquartersHomeLabel(hq, tournament.locationLabel)}
        </p>
      ) : null}
      <WeatherSection tournamentId={tournament.id} />
    </div>
  );

  return (
    <PullToRefresh>
      <DivisionSwipeBoundary
        publicBasePath={publicBasePath}
        divisionIdsOrdered={divisionDescriptors.map((d) => d.id)}
        defaultDivisionId={defaultDivisionTabId(divisionDescriptors)}
      >
        <div className="flex flex-col gap-4">
          {champion ? (
            <ChampionCelebration
              tournamentName={tournament.name}
              divisionName={champion.divisionName}
              winnerTeam={champion.winnerTeam}
            />
          ) : null}

          {!champion ? hqWeatherBlock : null}

          <FavoriteTeamsStrip
            tournamentId={tournament.id}
            divisionTabId={resolvedDivisionId || undefined}
            timezone={tournament.timezone}
          />

          {!champion && showPublicAnnouncements ? (
            <section>
              <SectionTitle className="mb-3">Announcements</SectionTitle>
              <div>
                <AnnouncementList
                  items={latestAnnouncement ? [latestAnnouncement] : []}
                  seeMoreHref={tp("announcements")}
                  compactMeta
                />
              </div>
            </section>
          ) : null}

          {!champion ? (
            <section>
              <SectionTitle className="mb-3">Upcoming games</SectionTitle>
              <div>
                <UpcomingGamesWithDivisionTabs
                  games={upcomingGames}
                  calendarTimezone={tournament.timezone}
                  tournamentId={tournament.id}
                />
              </div>
            </section>
          ) : null}

          <section>
            <SectionTitle className="mb-3">Recent results</SectionTitle>
            <GameList
              games={recentGames}
              timezone={tournament.timezone}
              displayTimesInViewerTimezone
              horizontal
              animateStagger
              tournamentId={tournament.id}
              emptyMessage="No recent games for this division yet."
              emptyHint="Final scores, cancelled games, and games awaiting results appear here."
            />
          </section>

          <div className="hidden grid-cols-2 gap-3 md:grid">
            <QuickLinkCard
              href={tp("schedule")}
              label="Schedule"
              description="Times, fields & matchups"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-7">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              }
            />
            <QuickLinkCard
              href={tp("results")}
              label="Results"
              description="Standings & completed games"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-7">
                  <path d="M8 21V16M12 21V10M16 21V4" />
                </svg>
              }
            />
            <QuickLinkCard
              href={tp("brackets")}
              label="Brackets"
              description="Playoff rounds"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-7">
                  <path d="M4 4v6h4M4 7h4M20 4v6h-4M20 7h-4M4 20v-6h4M4 17h4M20 20v-6h-4M20 17h-4M8 7h2a2 2 0 012 2v6a2 2 0 01-2 2H8M16 7h-2a2 2 0 00-2 2v6a2 2 0 002 2h2" />
                </svg>
              }
            />
            <QuickLinkCard
              href={tp("locations")}
              label="Locations"
              description="Venues & maps"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-7">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                  <circle cx="12" cy="9" r="2.5" />
                </svg>
              }
            />
          </div>

          {champion ? hqWeatherBlock : null}

          {tournament.showPublicSponsorsSection ? <SponsorMarquee tournamentId={tournament.id} /> : null}
        </div>
      </DivisionSwipeBoundary>
    </PullToRefresh>
  );
}
