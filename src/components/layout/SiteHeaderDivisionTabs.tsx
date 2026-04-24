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
import { brandCardGradientClass } from "@/lib/brand-card-gradient";
import { isDivisionTabBasePath } from "@/lib/tournament-public-path";

export function SiteHeaderDivisionTabs({
  tournamentSlug,
  publicBasePath,
  divisionDescriptors,
  cookieDivision,
}: {
  tournamentSlug: string;
  publicBasePath: string;
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

  const showTabs = isDivisionTabBasePath(pathname, publicBasePath) && tabs.length > 1;

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
      await setSelectedDivisionTabId(id, publicBasePath);
      const p = new URLSearchParams(searchParams.toString());
      p.set("division", id);
      const qs = p.toString();
      const next = qs ? `${pathname}?${qs}` : pathname;
      router.replace(next, { scroll: false });
    });
  };

  return (
    <div
      className={`ml-auto w-fit min-w-0 max-w-full rounded-xl border border-white/45 p-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.06)] backdrop-blur-md dark:border-zinc-600/50 dark:bg-none dark:bg-zinc-800/88 dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] ${brandCardGradientClass(`div-switcher-${tournamentSlug}`)}`}
    >
      <DivisionSwitcher
        divisions={tabs}
        selectedDivision={selectedDivision}
        onDivisionChange={onDivisionChange}
        disabled={pending}
      />
    </div>
  );
}
