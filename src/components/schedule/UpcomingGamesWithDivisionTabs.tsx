"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { divisionValidIdsWithAll } from "@/lib/division-tab-utils";
import {
  ALL_DIVISIONS_TAB_ID,
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

  const validIds = useMemo(() => divisionValidIdsWithAll(baseTabs), [baseTabs]);

  const effectiveDivisionId = useMemo(() => {
    if (baseTabs.length <= 1) return ALL_DIVISIONS_TAB_ID;
    const param = searchParams.get("division") ?? undefined;
    if (param && validIds.has(param)) return param;
    if (initialResolvedDivisionId && validIds.has(initialResolvedDivisionId)) {
      return initialResolvedDivisionId;
    }
    return ALL_DIVISIONS_TAB_ID;
  }, [baseTabs.length, searchParams, validIds, initialResolvedDivisionId]);

  const visible =
    baseTabs.length <= 1 ? games : games.filter((g) => gameMatchesDivisionTab(g, effectiveDivisionId));

  const scheduleHref = useMemo(() => {
    const p = new URLSearchParams();
    if (effectiveDivisionId && effectiveDivisionId !== ALL_DIVISIONS_TAB_ID) {
      p.set("division", effectiveDivisionId);
    }
    const qs = p.toString();
    return qs ? `/schedule?${qs}` : "/schedule";
  }, [effectiveDivisionId]);

  return (
    <div className="flex flex-col gap-3">
      <GameList
        games={visible}
        timezone={timezone}
        emptyMessage="No upcoming games scheduled for this division."
        emptyHint="Check another division or open the full schedule & results."
        horizontal
      />
      <p className="text-sm">
        <Link href={scheduleHref} className="font-medium text-royal-light hover:text-royal hover:underline">
          See schedule &amp; results
        </Link>
      </p>
    </div>
  );
}
