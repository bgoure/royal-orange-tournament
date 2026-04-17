"use client";

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

export function UpcomingGamesWithDivisionTabs({
  poolsForTabs,
  games,
  initialResolvedDivisionId,
  timezone,
}: {
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

  return (
    <div className="flex flex-col gap-3">
      <GameList
        games={visible}
        timezone={timezone}
        emptyMessage="No upcoming games scheduled for this division."
        emptyHint="Check another division or open the full schedule."
        horizontal
      />
    </div>
  );
}
