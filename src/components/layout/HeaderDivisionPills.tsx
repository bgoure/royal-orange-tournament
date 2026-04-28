"use client";

import { useCallback, useEffect, useMemo, useRef, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { setSelectedDivisionTabId } from "@/app/actions/tournament";
import type { DivisionTabDescriptor } from "@/lib/division-tabs";
import {
  defaultDivisionTabId,
  divisionValidIds,
  resolveDivisionTabForFilters,
} from "@/lib/division-tab-utils";
import { isDivisionTabBasePath } from "@/lib/tournament-public-path";
import { DIVISION_SWIPE_IGNORE } from "@/lib/division-swipe-ignore";

function triggerHaptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(8);
  }
}

export function HeaderDivisionPills({
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
  const pillWindowRef = useRef<HTMLDivElement>(null);

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

  const showPills = isDivisionTabBasePath(pathname, publicBasePath) && tabs.length > 1;

  const selectedDivision = tabs.some((t) => t.id === effectiveId)
    ? effectiveId
    : defaultId;

  const selectedTab = tabs.find((t) => t.id === selectedDivision);
  const selectedLabel = selectedTab?.name ?? "";

  useEffect(() => {
    if (!showPills || validIds.size <= 1) return;
    const p = new URLSearchParams(searchParams.toString());
    p.set("division", effectiveId);
    const oldDiv = searchParams.get("division");
    const newDiv = p.get("division");
    if (oldDiv === newDiv) return;
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, showPills, validIds.size, effectiveId, searchParams, router]);

  const onDivisionChange = useCallback((id: string) => {
    startTransition(async () => {
      await setSelectedDivisionTabId(id, publicBasePath);
      const p = new URLSearchParams(searchParams.toString());
      p.set("division", id);
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }, [publicBasePath, searchParams, pathname, router]);

  const advanceToNext = useCallback(() => {
    if (tabs.length === 0 || pending) return;
    const cur = tabs.findIndex((t) => t.id === selectedDivision);
    const base = cur >= 0 ? cur : 0;
    const next = (base + 1) % tabs.length;
    const nextId = tabs[next]!.id;

    const pw = pillWindowRef.current;
    if (pw) {
      pw.classList.remove("division-snap-animate");
      void pw.offsetWidth;
      pw.classList.add("division-snap-animate");
    }
    triggerHaptic();

    if (nextId !== selectedDivision) {
      onDivisionChange(nextId);
    }
  }, [tabs, selectedDivision, pending, onDivisionChange]);

  if (!showPills) return null;

  return (
    <div className="flex items-center md:gap-1.5">
      {/* Mobile: tap pill to cycle divisions (no horizontal scroll) */}
      <div className="relative flex flex-col items-center gap-1 md:hidden">
        <div className="flex gap-1.5" aria-hidden="true">
          {tabs.map((t) => (
            <span
              key={t.id}
              className="size-1.5 rounded-full bg-white transition-opacity duration-200"
              style={{ opacity: t.id === selectedDivision ? 1 : 0.3 }}
            />
          ))}
        </div>

        <button
          type="button"
          {...{ [DIVISION_SWIPE_IGNORE]: "" }}
          className="relative flex h-10 w-[8.25rem] shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-lg border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-royal-900 disabled:opacity-50"
          onClick={advanceToNext}
          disabled={pending}
          aria-label={`${selectedLabel}. Tap to switch division.`}
        >
          <div
            ref={pillWindowRef}
            className="pointer-events-none absolute left-1/2 top-0 h-full w-[5.5rem] -translate-x-1/2 rounded-lg bg-white shadow-sm"
          />
          <span
            className="relative z-10 max-w-full truncate px-1 text-center text-[1.53rem] font-bold leading-none text-royal"
          >
            {selectedLabel}
          </span>
        </button>
      </div>

      {/* Desktop: all pills inline */}
      <div className="hidden gap-1.5 md:flex" role="radiogroup" aria-label="Division">
        {tabs.map((d) => {
          const active = d.id === selectedDivision;
          return (
            <button
              key={d.id}
              type="button"
              role="radio"
              disabled={pending}
              aria-checked={active}
              onClick={() => onDivisionChange(d.id)}
              className={`min-h-[40px] shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
                active ? "bg-white text-royal shadow-sm" : "bg-white/15 text-white/80 hover:bg-white/25 hover:text-white"
              }`}
            >
              {d.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
