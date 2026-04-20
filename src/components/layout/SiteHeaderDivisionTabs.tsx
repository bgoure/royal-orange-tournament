"use client";

import { useEffect, useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { setSelectedDivisionTabId } from "@/app/actions/tournament";
import { DivisionSwitcher } from "@/components/layout/DivisionSwitcher";
import type { DivisionTabDescriptor } from "@/lib/division-tabs";
import {
  defaultDivisionTabId,
  divisionValidIds,
  resolveDivisionTabForFilters,
} from "@/lib/division-tab-utils";
import { isDivisionTabBasePath } from "@/lib/tournament-public-path";

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

  const tabs = useMemo(() => {
    if (divisionDescriptors.length <= 1) return [];
    return divisionDescriptors;
  }, [divisionDescriptors]);

  const validIds = useMemo(
    () => divisionValidIds(divisionDescriptors),
    [divisionDescriptors],
  );

  const defaultTabId = useMemo(
    () => defaultDivisionTabId(divisionDescriptors),
    [divisionDescriptors],
  );

  const effectiveId = useMemo(() => {
    if (tabs.length === 0) return defaultTabId;
    return resolveDivisionTabForFilters(
      searchParams.get("division") ?? undefined,
      cookieDivision,
      validIds,
      defaultTabId,
    );
  }, [tabs.length, searchParams, cookieDivision, validIds, defaultTabId]);

  const showTabs = isDivisionTabBasePath(pathname, tournamentSlug) && tabs.length > 1;

  const selectedDivision = tabs.some((t) => t.id === effectiveId)
    ? effectiveId
    : defaultTabId;

  useEffect(() => {
    if (!showTabs) return;
    if (validIds.size <= 1) return;

    const p = new URLSearchParams(searchParams.toString());
    p.set("division", effectiveId);

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
      p.set("division", id);
      const qs = p.toString();
      const next = qs ? `${pathname}?${qs}` : pathname;
      router.replace(next, { scroll: false });
    });
  };

  return (
    <div className="ml-auto w-fit min-w-0 max-w-full rounded-xl bg-white/95 p-1.5 shadow-sm ring-1 ring-white/20">
      <DivisionSwitcher
        divisions={tabs}
        selectedDivision={selectedDivision}
        onDivisionChange={onDivisionChange}
        disabled={pending}
      />
    </div>
  );
}
