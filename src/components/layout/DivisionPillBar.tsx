"use client";

import { useEffect, useMemo, useRef, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { setSelectedDivisionTabId } from "@/app/actions/tournament";
import type { DivisionTabDescriptor } from "@/lib/division-tabs";
import {
  defaultDivisionTabId,
  divisionValidIds,
  resolveDivisionTabForFilters,
} from "@/lib/division-tab-utils";
import {
  schedulePillActive,
  schedulePillInactive,
  schedulePillTapMin,
  schedulePillTransition,
} from "@/lib/schedule-pill-styles";
import { isDivisionTabBasePath } from "@/lib/tournament-public-path";
import { DIVISION_SWIPE_IGNORE } from "@/lib/division-swipe-ignore";

export function DivisionPillBar({
  publicBasePath,
  divisionDescriptors,
  cookieDivision,
}: {
  publicBasePath: string;
  divisionDescriptors: DivisionTabDescriptor[];
  cookieDivision: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const tabs = useMemo(() => {
    if (divisionDescriptors.length <= 1) return [];
    return divisionDescriptors;
  }, [divisionDescriptors]);

  const validIds = useMemo(
    () => divisionValidIds(divisionDescriptors),
    [divisionDescriptors],
  );

  const defaultId = useMemo(
    () => defaultDivisionTabId(divisionDescriptors),
    [divisionDescriptors],
  );

  const effectiveId = useMemo(() => {
    if (tabs.length === 0) return defaultId;
    return resolveDivisionTabForFilters(
      searchParams.get("division") ?? undefined,
      cookieDivision,
      validIds,
      defaultId,
    );
  }, [tabs.length, searchParams, cookieDivision, validIds, defaultId]);

  const showBar = isDivisionTabBasePath(pathname, publicBasePath) && tabs.length > 1;

  const selectedDivision = tabs.some((t) => t.id === effectiveId)
    ? effectiveId
    : defaultId;

  useEffect(() => {
    if (!showBar || validIds.size <= 1) return;
    const p = new URLSearchParams(searchParams.toString());
    p.set("division", effectiveId);
    const oldDiv = searchParams.get("division");
    const newDiv = p.get("division");
    if (oldDiv === newDiv) return;
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, showBar, validIds.size, effectiveId, searchParams, router]);

  useEffect(() => {
    if (tabs.length < 2) return;
    const idx = tabs.findIndex((d) => d.id === selectedDivision);
    if (idx < 0) return;
    const el = pillRefs.current[idx];
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [tabs, selectedDivision]);

  if (!showBar) return null;

  const onDivisionChange = (id: string) => {
    startTransition(async () => {
      await setSelectedDivisionTabId(id, publicBasePath);
      const p = new URLSearchParams(searchParams.toString());
      p.set("division", id);
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };

  return (
    <div className="border-b border-zinc-200/80 bg-white/80 backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-950/80">
      <div
        ref={scrollRef}
        {...{ [DIVISION_SWIPE_IGNORE]: "" }}
        className="no-scrollbar mx-auto flex max-w-5xl gap-2 overflow-x-auto scroll-smooth px-4 py-2 snap-x snap-mandatory md:flex-wrap md:overflow-x-visible md:snap-none md:justify-center"
        role="radiogroup"
        aria-label="Division"
      >
        {tabs.map((d, index) => {
          const active = d.id === selectedDivision;
          return (
            <button
              key={d.id}
              ref={(el) => { pillRefs.current[index] = el; }}
              type="button"
              role="radio"
              disabled={pending}
              aria-checked={active}
              onClick={() => onDivisionChange(d.id)}
              className={[
                schedulePillTapMin,
                schedulePillTransition,
                "snap-start",
                "disabled:pointer-events-none disabled:opacity-50",
                "min-w-0 shrink-0 whitespace-nowrap rounded-lg px-[14px] py-2.5 text-sm",
                "sm:text-base md:min-w-[7.5rem]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal focus-visible:ring-offset-2",
                active ? schedulePillActive : schedulePillInactive,
              ].join(" ")}
            >
              {d.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
