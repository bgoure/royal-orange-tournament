"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { BracketsView } from "@/components/brackets/BracketsView";
import type { BracketWith, GameRow } from "@/components/brackets/bracket-types";
import {
  defaultDivisionTabId,
  divisionValidIds,
} from "@/lib/division-tab-utils";
import {
  buildDivisionTabDescriptors,
  consolationGameMatchesDivisionTab,
  entityDivisionMatchesTab,
  type PoolForDivisionTabs,
} from "@/lib/division-tabs";

/** Each bracket belongs to one division; synthetic age tabs match pools in that division. */
function filterBracketsForTab(
  brackets: BracketWith[],
  tabId: string,
  poolsForTabs: PoolForDivisionTabs[],
): BracketWith[] {
  return brackets.filter((b) => entityDivisionMatchesTab(b.divisionId, tabId, poolsForTabs));
}

/** Division filter is controlled from the site header; this view only applies it. */
export function BracketsViewWithDivisionTabs({
  poolsForTabs,
  brackets,
  consolationGames = [],
  initialResolvedDivisionId,
  tournamentName,
  tournamentShortLabel,
  tournamentTimezone,
  headerLogoUrl,
  showHomeAway = true,
}: {
  poolsForTabs: PoolForDivisionTabs[];
  brackets: BracketWith[];
  consolationGames?: GameRow[];
  initialResolvedDivisionId: string;
  tournamentName: string;
  tournamentShortLabel?: string | null;
  tournamentTimezone?: string | null;
  headerLogoUrl?: string | null;
  showHomeAway?: boolean;
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

  const visibleBrackets = useMemo(
    () => filterBracketsForTab(brackets, effectiveDivisionId, poolsForTabs),
    [brackets, effectiveDivisionId, poolsForTabs],
  );

  const visibleConsolation = useMemo(
    () =>
      consolationGames.filter((g) =>
        consolationGameMatchesDivisionTab(g, effectiveDivisionId, poolsForTabs),
      ),
    [consolationGames, effectiveDivisionId, poolsForTabs],
  );

  const divisionName = useMemo(
    () => baseTabs.find((t) => t.id === effectiveDivisionId)?.name ?? visibleBrackets[0]?.division.name ?? null,
    [baseTabs, effectiveDivisionId, visibleBrackets],
  );

  return (
    <>
      {brackets.length > 0 && visibleBrackets.length === 0 ? (
        <p className="text-sm text-zinc-500">No published playoff bracket for this division.</p>
      ) : (
        <BracketsView
          brackets={visibleBrackets}
          consolationGames={visibleConsolation}
          tournamentName={tournamentName}
          tournamentShortLabel={tournamentShortLabel}
          divisionName={divisionName}
          headerLogoUrl={headerLogoUrl}
          tournamentTimezone={tournamentTimezone}
          showHomeAway={showHomeAway}
        />
      )}
    </>
  );
}
