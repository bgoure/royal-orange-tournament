"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { setSelectedDivisionTabId } from "@/app/actions/tournament";
import {
  ALL_DIVISIONS_TAB_ID,
  buildDivisionTabDescriptors,
  gameMatchesDivisionTab,
  type PoolForDivisionTabs,
} from "@/lib/division-tabs";
import { GameList, type GameWithTeams } from "@/components/schedule/GameList";

type TabOption = { id: string; name: string };

export function UpcomingGamesWithDivisionTabs({
  poolsForTabs,
  games,
  initialResolvedDivisionId,
}: {
  poolsForTabs: PoolForDivisionTabs[];
  games: GameWithTeams[];
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
  const visible =
    tabs.length === 0 ? games : games.filter((g) => gameMatchesDivisionTab(g, activeId));

  const scheduleHref = useMemo(() => {
    const p = new URLSearchParams();
    if (activeId && activeId !== ALL_DIVISIONS_TAB_ID) p.set("division", activeId);
    const qs = p.toString();
    return qs ? `/schedule?${qs}` : "/schedule";
  }, [activeId]);

  return (
    <div className="flex flex-col gap-3">
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
      <GameList games={visible} emptyMessage="No upcoming games scheduled for this division." />
      <p className="text-sm">
        <Link href={scheduleHref} className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline">
          See more
        </Link>
      </p>
    </div>
  );
}
