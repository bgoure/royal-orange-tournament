"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { BracketsView } from "@/components/brackets/BracketsView";
import type { BracketWith } from "@/components/brackets/bracket-types";
import {
  defaultDivisionTabId,
  divisionValidIds,
} from "@/lib/division-tab-utils";
import {
  buildDivisionTabDescriptors,
  type PoolForDivisionTabs,
} from "@/lib/division-tabs";

/** Each bracket belongs to one division; games inherit that scope. */
function filterBracketsForTab(brackets: BracketWith[], tabId: string): BracketWith[] {
  return brackets.filter((b) => b.divisionId === tabId);
}

/** Division filter is controlled from the site header; this view only applies it. */
export function BracketsViewWithDivisionTabs({
  poolsForTabs,
  brackets,
  initialResolvedDivisionId,
  tournamentTimezone,
}: {
  poolsForTabs: PoolForDivisionTabs[];
  brackets: BracketWith[];
  initialResolvedDivisionId: string;
  tournamentTimezone?: string | null;
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
    () => filterBracketsForTab(brackets, effectiveDivisionId),
    [brackets, effectiveDivisionId],
  );

  return (
    <>
      {brackets.length > 0 && visibleBrackets.length === 0 ? (
        <p className="text-sm text-zinc-500">No published playoff bracket for this division.</p>
      ) : (
        <BracketsView brackets={visibleBrackets} tournamentTimezone={tournamentTimezone} />
      )}
    </>
  );
}
