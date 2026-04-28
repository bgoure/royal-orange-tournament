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

const REPEAT_COUNT = 20;

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSnappedIdx = useRef(-1);
  const isUserScrolling = useRef(false);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayedIdRef = useRef<string | null>(null);
  const dotContainerRef = useRef<HTMLDivElement>(null);

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

  const repeatedTabs = useMemo(() => {
    if (tabs.length === 0) return [];
    const arr: (DivisionTabDescriptor & { realIndex: number })[] = [];
    for (let r = 0; r < REPEAT_COUNT; r++) {
      for (let i = 0; i < tabs.length; i++) {
        arr.push({ ...tabs[i]!, realIndex: i });
      }
    }
    return arr;
  }, [tabs]);

  const scrollToRealIndex = useCallback((realIndex: number, behavior: ScrollBehavior = "instant") => {
    const el = scrollRef.current;
    if (!el || tabs.length === 0) return;
    const midRepeat = Math.floor(REPEAT_COUNT / 2);
    const targetIdx = midRepeat * tabs.length + realIndex;
    const child = el.children[targetIdx] as HTMLElement | undefined;
    if (!child) return;
    const offset = child.offsetLeft - (el.clientWidth - child.offsetWidth) / 2;
    el.scrollTo({ left: offset, behavior });
  }, [tabs]);

  useEffect(() => {
    if (!showPills || tabs.length === 0) return;
    const idx = tabs.findIndex((t) => t.id === selectedDivision);
    if (idx >= 0) {
      lastSnappedIdx.current = idx;
      displayedIdRef.current = selectedDivision;
      requestAnimationFrame(() => scrollToRealIndex(idx, "instant"));
    }
  }, [showPills, tabs, selectedDivision, scrollToRealIndex]);

  const onDivisionChange = useCallback((id: string) => {
    startTransition(async () => {
      await setSelectedDivisionTabId(id, publicBasePath);
      const p = new URLSearchParams(searchParams.toString());
      p.set("division", id);
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }, [publicBasePath, searchParams, pathname, router]);

  const updateDots = useCallback(() => {
    if (!dotContainerRef.current || tabs.length === 0) return;
    const dots = dotContainerRef.current.children;
    for (let i = 0; i < dots.length; i++) {
      const dot = dots[i] as HTMLElement;
      dot.style.opacity = tabs[i]!.id === displayedIdRef.current ? "1" : "0.3";
    }
  }, [tabs]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || tabs.length === 0) return;

    isUserScrolling.current = true;

    const center = el.scrollLeft + el.clientWidth / 2;
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < el.children.length; i++) {
      const child = el.children[i] as HTMLElement;
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      const dist = Math.abs(center - childCenter);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }

    const realIdx = closestIdx % tabs.length;

    if (realIdx !== lastSnappedIdx.current) {
      lastSnappedIdx.current = realIdx;
      displayedIdRef.current = tabs[realIdx]!.id;
      updateDots();
      triggerHaptic();
    }

    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      isUserScrolling.current = false;
      const finalCenter = el.scrollLeft + el.clientWidth / 2;
      let finalIdx = 0;
      let finalDist = Infinity;
      for (let i = 0; i < el.children.length; i++) {
        const child = el.children[i] as HTMLElement;
        const childCenter = child.offsetLeft + child.offsetWidth / 2;
        const dist = Math.abs(finalCenter - childCenter);
        if (dist < finalDist) {
          finalDist = dist;
          finalIdx = i;
        }
      }
      const finalRealIdx = finalIdx % tabs.length;
      scrollToRealIndex(finalRealIdx, "instant");
      const divId = tabs[finalRealIdx]!.id;
      if (divId !== selectedDivision) {
        onDivisionChange(divId);
      }
    }, 150);
  }, [tabs, selectedDivision, scrollToRealIndex, onDivisionChange, updateDots]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  if (!showPills) return null;

  if (displayedIdRef.current === null) {
    displayedIdRef.current = selectedDivision;
  }

  return (
    <div className="flex items-center gap-2 md:gap-1.5">
      {/* Carousel picker — white pill window on mobile */}
      <div
        className="relative overflow-hidden rounded-lg bg-white shadow-sm md:hidden"
        style={{ width: "5.5rem", height: "2.5rem" }}
      >
        <div
          ref={scrollRef}
          {...{ [DIVISION_SWIPE_IGNORE]: "" }}
          className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto scroll-smooth"
        >
          {repeatedTabs.map((d, i) => (
            <div
              key={`${d.id}-${i}`}
              className="flex h-full w-[5.5rem] shrink-0 snap-center items-center justify-center text-sm font-bold text-royal"
            >
              {d.name}
            </div>
          ))}
        </div>
        {/* Soft edge fades */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-white/80 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-white/80 to-transparent" />
      </div>

      {/* Dot indicator */}
      <div ref={dotContainerRef} className="flex gap-1 md:hidden">
        {tabs.map((t) => (
          <span
            key={t.id}
            className="size-1.5 rounded-full bg-white transition-opacity duration-200"
            style={{ opacity: t.id === selectedDivision ? 1 : 0.3 }}
          />
        ))}
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
              className={`shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-200 min-h-[40px] ${
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
