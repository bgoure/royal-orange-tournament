"use client";

import { useEffect, useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { setSelectedDivisionTabId } from "@/app/actions/tournament";
import { DivisionTabs } from "@/components/layout/DivisionTabs";
import {
  ALL_DIVISIONS_TAB_ID,
  type DivisionTabDescriptor,
} from "@/lib/division-tabs";
import {
  divisionValidIdsWithAll,
  resolveDivisionTabForFilters,
} from "@/lib/division-tab-utils";
import { isDivisionTabBasePath } from "@/lib/tournament-public-path";

type TabOption = { id: string; name: string };

export function SiteHeaderDivisionTabs({
  tournamentSlug,
  divisionDescriptors,
  cookieDivision,
}: {
  tournamentSlug: string;
  divisionDescriptors: DivisionTabDescriptor[];
  cookieDivision: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const tabs: TabOption[] = useMemo(() => {
    if (divisionDescriptors.length <= 1) return [];
    return [{ id: ALL_DIVISIONS_TAB_ID, name: "All" }, ...divisionDescriptors];
  }, [divisionDescriptors]);

  const validIds = useMemo(
    () => divisionValidIdsWithAll(divisionDescriptors),
    [divisionDescriptors],
  );

  const effectiveId = useMemo(() => {
    if (tabs.length === 0) return ALL_DIVISIONS_TAB_ID;
    return resolveDivisionTabForFilters(
      searchParams.get("division") ?? undefined,
      cookieDivision,
      validIds,
    );
  }, [tabs.length, searchParams, cookieDivision, validIds]);

  const activeIndex = useMemo(() => {
    const i = tabs.findIndex((t) => t.id === effectiveId);
    return i >= 0 ? i : 0;
  }, [tabs, effectiveId]);

  const showTabs = isDivisionTabBasePath(pathname, tournamentSlug) && tabs.length > 1;

  useEffect(() => {
    if (!showTabs) return;
    if (validIds.size <= 1) return;

    const p = new URLSearchParams(searchParams.toString());
    const nextDiv =
      effectiveId === ALL_DIVISIONS_TAB_ID ? null : effectiveId;
    if (nextDiv === null) p.delete("division");
    else p.set("division", nextDiv);

    const oldDiv = searchParams.get("division");
    const newDiv = p.get("division");
    if (oldDiv === newDiv) return;

    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [
    pathname,
    showTabs,
    validIds.size,
    effectiveId,
    cookieDivision,
    searchParams,
    router,
  ]);

  if (!showTabs) return null;

  const selectTab = (i: number) => {
    const id = tabs[i]?.id;
    if (!id) return;
    startTransition(async () => {
      await setSelectedDivisionTabId(id, tournamentSlug);
      const p = new URLSearchParams(searchParams.toString());
      if (id === ALL_DIVISIONS_TAB_ID) p.delete("division");
      else p.set("division", id);
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };

  return (
    <div className="min-w-0 max-w-full rounded-xl bg-white/95 p-1.5 shadow-sm ring-1 ring-white/20">
      <DivisionTabs
        variant="light"
        className="border-0 pb-0"
        tabs={tabs}
        activeIndex={activeIndex}
        onSelect={selectTab}
        disabled={pending}
      />
    </div>
  );
}
