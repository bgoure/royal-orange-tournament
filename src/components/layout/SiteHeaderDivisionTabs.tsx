"use client";

import { useEffect, useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { setSelectedDivisionTabId } from "@/app/actions/tournament";
import { DivisionSwitcher } from "@/components/layout/DivisionSwitcher";
import {
  ALL_DIVISIONS_TAB_ID,
  type DivisionTabDescriptor,
} from "@/lib/division-tabs";
import {
  divisionValidIdsWithAll,
  resolveDivisionTabForFilters,
} from "@/lib/division-tab-utils";
import { isDivisionTabBasePath } from "@/lib/tournament-public-path";

export function SiteHeaderDivisionTabs({
  tournamentSlug,
  divisionDescriptors,
}: {
  tournamentSlug: string;
  divisionDescriptors: DivisionTabDescriptor[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const tabs = useMemo(() => {
    if (divisionDescriptors.length <= 1) return [];
    return [{ id: ALL_DIVISIONS_TAB_ID, name: "All" }, ...divisionDescriptors];
  }, [divisionDescriptors]);

  const validIds = useMemo(
    () => divisionValidIdsWithAll(divisionDescriptors),
    [divisionDescriptors],
  );

  const defaultTabId = useMemo(
    () => tabs[0]?.id ?? ALL_DIVISIONS_TAB_ID,
    [tabs],
  );

  const effectiveId = useMemo(() => {
    if (tabs.length === 0) return ALL_DIVISIONS_TAB_ID;
    return resolveDivisionTabForFilters(
      searchParams.get("division") ?? undefined,
      validIds,
      defaultTabId,
    );
  }, [tabs.length, searchParams, validIds, defaultTabId]);

  const showTabs = isDivisionTabBasePath(pathname, tournamentSlug) && tabs.length > 1;

  const selectedDivision = tabs.some((t) => t.id === effectiveId)
    ? effectiveId
    : defaultTabId;

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
  }, [pathname, showTabs, validIds.size, effectiveId, searchParams, router]);

  if (!showTabs) return null;

  const onDivisionChange = (id: string) => {
    startTransition(async () => {
      await setSelectedDivisionTabId(id, tournamentSlug);
      const p = new URLSearchParams(searchParams.toString());
      if (id === ALL_DIVISIONS_TAB_ID) p.delete("division");
      else p.set("division", id);
      const qs = p.toString();
      const next = qs ? `${pathname}?${qs}` : pathname;
      router.replace(next, { scroll: false });
    });
  };

  return (
    <div className="min-w-0 max-w-full rounded-xl bg-white/95 p-1.5 shadow-sm ring-1 ring-white/20">
      <DivisionSwitcher
        divisions={tabs}
        selectedDivision={selectedDivision}
        onDivisionChange={onDivisionChange}
        disabled={pending}
      />
    </div>
  );
}
