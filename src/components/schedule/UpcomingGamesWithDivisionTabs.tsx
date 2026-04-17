"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  defaultDivisionTabId,
  divisionValidIds,
} from "@/lib/division-tab-utils";
import {
  buildDivisionTabDescriptors,
  gameMatchesDivisionTab,
  type PoolForDivisionTabs,
} from "@/lib/division-tabs";
import { GameList, type GameWithTeams } from "@/components/schedule/GameList";
import { tournamentPath } from "@/lib/tournament-public-path";

export function UpcomingGamesWithDivisionTabs({
  tournamentSlug,
  poolsForTabs,
  games,
  initialResolvedDivisionId,
  timezone,
}: {
  tournamentSlug: string;
  poolsForTabs: PoolForDivisionTabs[];
  games: GameWithTeams[];
  initialResolvedDivisionId: string;
  timezone: string;
}) {
  const searchParams = useSearchParams();

  const baseTabs = useMemo(() => buildDivisionTabDescriptors(poolsForTabs), [poolsForTabs]);

  const defaultTab = useMemo(() => defaultDivisionTabId(baseTabs), [baseTabs]);

  const validIds = useMemo(() => divisionValidIds(baseTabs), [baseTabs]);

  const effectiveDivisionId = useMemo(() => {
    if (baseTabs.length <= 1) return defaultTab;
    const param = searchParams.get("division") ?? undefined;
    if (param && validIds.has(param)) return param;
    if (initialResolvedDivisionId && validIds.has(initialResolvedDivisionId)) {
      return initialResolvedDivisionId;
    }
    return defaultTab;
  }, [baseTabs.length, searchParams, validIds, initialResolvedDivisionId, defaultTab]);

  const visible =
    baseTabs.length <= 1 ? games : games.filter((g) => gameMatchesDivisionTab(g, effectiveDivisionId));

  const scheduleHref = useMemo(() => {
    const p = new URLSearchParams();
    if (baseTabs.length > 1 && effectiveDivisionId) {
      p.set("division", effectiveDivisionId);
    }
    const qs = p.toString();
    const base = tournamentPath(tournamentSlug, "schedule");
    return qs ? `${base}?${qs}` : base;
  }, [effectiveDivisionId, baseTabs.length, tournamentSlug]);

  return (
    <div className="flex flex-col gap-3">
      <GameList
        games={visible}
        timezone={timezone}
        emptyMessage="No upcoming games scheduled for this division."
        emptyHint="Check another division or open the full schedule."
        horizontal
      />
      <p className="text-sm">
        <Link href={scheduleHref} className="font-medium text-royal-light hover:text-royal hover:underline">
          See schedule
        </Link>
      </p>
    </div>
  );
}
