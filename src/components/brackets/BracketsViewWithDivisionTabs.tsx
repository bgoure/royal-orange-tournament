"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Bracket, BracketRound, Division, Field, Game, Pool, Team } from "@prisma/client";
import { setSelectedDivisionTabId } from "@/app/actions/tournament";
import { BracketsView } from "@/components/brackets/BracketsView";
import {
  ALL_DIVISIONS_TAB_ID,
  bracketGameMatchesDivisionTab,
  buildDivisionTabDescriptors,
  type PoolForDivisionTabs,
} from "@/lib/division-tabs";

type TeamWithPool = Team & {
  pool: (Pool & { division: Division }) | null;
};

type GameRow = Game & {
  homeTeam: TeamWithPool | null;
  awayTeam: TeamWithPool | null;
  field: Field & { location: { name: string } };
  bracketRound: BracketRound | null;
};

type BracketWith = Bracket & {
  rounds: BracketRound[];
  games: GameRow[];
};

type TabOption = { id: string; name: string };

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

/** Division pills align with home, schedule, and standings. */
export function BracketsViewWithDivisionTabs({
  poolsForTabs,
  brackets,
  initialResolvedDivisionId,
}: {
  poolsForTabs: PoolForDivisionTabs[];
  brackets: BracketWith[];
  initialResolvedDivisionId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const baseTabs = useMemo(() => buildDivisionTabDescriptors(poolsForTabs), [poolsForTabs]);

  const tabs: TabOption[] = useMemo(() => {
    if (baseTabs.length <= 1) return [];
    return [{ id: ALL_DIVISIONS_TAB_ID, name: "All" }, ...baseTabs];
  }, [baseTabs]);

  const tabIds = useMemo(() => tabs.map((t) => t.id), [tabs]);

  const effectiveDivisionId = useMemo(() => {
    if (tabs.length === 0) return ALL_DIVISIONS_TAB_ID;
    const param = searchParams.get("division");
    if (param && tabIds.includes(param)) return param;
    if (initialResolvedDivisionId && tabIds.includes(initialResolvedDivisionId)) {
      return initialResolvedDivisionId;
    }
    return ALL_DIVISIONS_TAB_ID;
  }, [searchParams, tabIds, tabs.length, initialResolvedDivisionId]);

  const tabIndex = useMemo(() => {
    const i = tabIds.indexOf(effectiveDivisionId);
    return i >= 0 ? i : 0;
  }, [effectiveDivisionId, tabIds]);

  const [tab, setTab] = useState(tabIndex);

  useEffect(() => {
    setTab(tabIndex);
  }, [tabIndex]);

  useEffect(() => {
    if (tabs.length <= 1) return;
    const param = searchParams.get("division");
    if (!param && effectiveDivisionId !== ALL_DIVISIONS_TAB_ID) {
      const p = new URLSearchParams(searchParams.toString());
      p.set("division", effectiveDivisionId);
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    }
  }, [tabs.length, effectiveDivisionId, pathname, router, searchParams]);

  const selectTab = useCallback(
    (i: number) => {
      const id = tabs[i]?.id;
      if (!id) return;
      setTab(i);
      startTransition(async () => {
        await setSelectedDivisionTabId(id);
        const p = new URLSearchParams(searchParams.toString());
        if (id === ALL_DIVISIONS_TAB_ID) p.delete("division");
        else p.set("division", id);
        const qs = p.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [tabs, pathname, router, searchParams],
  );

  const activeId = tabs[tab]?.id ?? ALL_DIVISIONS_TAB_ID;
  const visibleBrackets = useMemo(
    () => filterBracketsForTab(brackets, activeId),
    [brackets, activeId],
  );

  return (
    <div className="flex flex-col gap-4">
      {tabs.length > 1 ? (
        <div
          className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3"
          role="tablist"
          aria-label="Divisions"
        >
          {tabs.map((d, i) => (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={i === tab}
              disabled={pending}
              onClick={() => selectTab(i)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                i === tab
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>
      ) : null}
      {brackets.length > 0 && visibleBrackets.length === 0 ? (
        <p className="text-sm text-zinc-500">No bracket games for this division.</p>
      ) : (
        <BracketsView brackets={visibleBrackets} />
      )}
    </div>
  );
}
