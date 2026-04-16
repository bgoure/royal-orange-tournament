"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import type {
  Bracket,
  BracketMatch,
  BracketRound,
  Division,
  Field,
  Game,
  Pool,
  Team,
} from "@prisma/client";
import { BracketsView } from "@/components/brackets/BracketsView";
import { divisionValidIdsWithAll } from "@/lib/division-tab-utils";
import {
  ALL_DIVISIONS_TAB_ID,
  bracketGameMatchesDivisionTab,
  buildDivisionTabDescriptors,
  type PoolForDivisionTabs,
} from "@/lib/division-tabs";

type TeamWithPool = Team & {
  pool: (Pool & { division: Division }) | null;
};

type BracketMatchWithPools = BracketMatch & {
  homeSourcePool: (Pool & { division: Division }) | null;
  awaySourcePool: (Pool & { division: Division }) | null;
};

type GameRow = Game & {
  homeTeam: TeamWithPool | null;
  awayTeam: TeamWithPool | null;
  field: Field & { location: { name: string } };
  bracketRound: BracketRound | null;
  bracketMatch: BracketMatchWithPools | null;
};

type BracketWith = Bracket & {
  rounds: BracketRound[];
  games: GameRow[];
};

function filterBracketsForTab(brackets: BracketWith[], tabId: string): BracketWith[] {
  if (tabId === ALL_DIVISIONS_TAB_ID) return brackets;
  return brackets
    .map((b) => {
      const games = b.games.filter((g) => bracketGameMatchesDivisionTab(g, tabId));
      if (games.length === 0) return null;
      const roundIds = new Set(
        games.map((g) => g.bracketRoundId).filter((id): id is string => id != null),
      );
      const rounds = b.rounds.filter((r) => roundIds.has(r.id));
      return { ...b, games, rounds };
    })
    .filter((b): b is BracketWith => b != null);
}

/** Division filter is controlled from the site header; this view only applies it. */
export function BracketsViewWithDivisionTabs({
  poolsForTabs,
  brackets,
  initialResolvedDivisionId,
}: {
  poolsForTabs: PoolForDivisionTabs[];
  brackets: BracketWith[];
  initialResolvedDivisionId: string;
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

  const visibleBrackets = useMemo(
    () => filterBracketsForTab(brackets, effectiveDivisionId),
    [brackets, effectiveDivisionId],
  );

  return (
    <>
      {brackets.length > 0 && visibleBrackets.length === 0 ? (
        <p className="text-sm text-zinc-500">No bracket games for this division.</p>
      ) : (
        <BracketsView brackets={visibleBrackets} />
      )}
    </>
  );
}
