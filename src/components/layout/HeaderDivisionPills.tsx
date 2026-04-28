"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
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
  const programmaticScrollRef = useRef(false);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pillWindowRef = useRef<HTMLDivElement>(null);

  const [visualDivisionId, setVisualDivisionId] = useState<string | null>(null);

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

  const mobileDisplayId = visualDivisionId ?? selectedDivision;

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

  const endProgrammaticScroll = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        programmaticScrollRef.current = false;
      });
    });
  }, []);

  const onDivisionChange = useCallback((id: string) => {
    startTransition(async () => {
      await setSelectedDivisionTabId(id, publicBasePath);
      const p = new URLSearchParams(searchParams.toString());
      p.set("division", id);
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }, [publicBasePath, searchParams, pathname, router]);

  useEffect(() => {
    if (!showPills || tabs.length === 0) return;
    const idx = tabs.findIndex((t) => t.id === selectedDivision);
    if (idx < 0) return;
    lastSnappedIdx.current = idx;
    requestAnimationFrame(() => {
      setVisualDivisionId(selectedDivision);
      programmaticScrollRef.current = true;
      scrollToRealIndex(idx, "instant");
      endProgrammaticScroll();
    });
  }, [showPills, tabs, selectedDivision, scrollToRealIndex, endProgrammaticScroll]);

  const runScrollSettle = useCallback(() => {
    const el = scrollRef.current;
    if (!el || tabs.length === 0) return;

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
    programmaticScrollRef.current = true;
    scrollToRealIndex(finalRealIdx, "instant");
    lastSnappedIdx.current = finalRealIdx;
    const divId = tabs[finalRealIdx]!.id;
    setVisualDivisionId(divId);
    endProgrammaticScroll();
    if (divId !== selectedDivision) {
      onDivisionChange(divId);
    }
  }, [tabs, selectedDivision, scrollToRealIndex, onDivisionChange, endProgrammaticScroll]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || tabs.length === 0) return;
    if (programmaticScrollRef.current) return;

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
      const id = tabs[realIdx]!.id;
      setVisualDivisionId(id);
      triggerHaptic();
      const pw = pillWindowRef.current;
      if (pw) {
        pw.classList.remove("division-snap-animate");
        void pw.offsetWidth;
        pw.classList.add("division-snap-animate");
      }
    }

    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      if (programmaticScrollRef.current) return;
      runScrollSettle();
    }, 150);
  }, [tabs, runScrollSettle]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  const advanceToNext = useCallback(() => {
    if (tabs.length === 0) return;
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
      scrollTimeout.current = null;
    }

    const cur = tabs.findIndex((t) => t.id === selectedDivision);
    const base = cur >= 0 ? cur : 0;
    const next = (base + 1) % tabs.length;
    const nextId = tabs[next]!.id;

    programmaticScrollRef.current = true;
    scrollToRealIndex(next, "instant");
    lastSnappedIdx.current = next;
    setVisualDivisionId(nextId);

    const pw = pillWindowRef.current;
    if (pw) {
      pw.classList.remove("division-snap-animate");
      void pw.offsetWidth;
      pw.classList.add("division-snap-animate");
    }
    triggerHaptic();
    endProgrammaticScroll();

    if (nextId !== selectedDivision) {
      onDivisionChange(nextId);
    }
  }, [tabs, selectedDivision, scrollToRealIndex, onDivisionChange, endProgrammaticScroll]);

  if (!showPills) return null;

  return (
    <div className="flex items-center md:gap-1.5">
      {/* Mobile: carousel picker with wider invisible touch zone */}
      <div className="relative flex flex-col items-center gap-1 md:hidden">
        {/* Dot indicator — above the pill */}
        <div className="flex gap-1.5">
          {tabs.map((t) => (
            <span
              key={t.id}
              className="size-1.5 rounded-full bg-white transition-opacity duration-200"
              style={{ opacity: t.id === mobileDisplayId ? 1 : 0.3 }}
            />
          ))}
        </div>

        <div
          className="relative cursor-pointer touch-manipulation"
          style={{ width: "8.25rem" }}
          onClick={advanceToNext}
        >
          {/* Visible white pill window — centered */}
          <div
            ref={pillWindowRef}
            className="pointer-events-none absolute left-1/2 top-0 h-full -translate-x-1/2 rounded-lg bg-white shadow-sm"
            style={{ width: "5.5rem" }}
          />
          {/* Scroll container — no scroll-smooth: avoids fighting snap + programmatic scroll */}
          <div
            ref={scrollRef}
            {...{ [DIVISION_SWIPE_IGNORE]: "" }}
            className="no-scrollbar relative flex snap-x snap-mandatory overflow-x-auto"
            style={{ height: "2.5rem" }}
          >
            {repeatedTabs.map((d, i) => (
              <div
                key={`${d.id}-${i}`}
                data-division-id={d.id}
                className={`division-carousel-item flex h-full shrink-0 snap-center items-center justify-center font-bold transition-colors duration-150 ${
                  d.id === mobileDisplayId ? "text-royal" : "text-white/50"
                }`}
                style={{ width: "8.25rem", fontSize: "1.53rem" }}
              >
                {d.name}
              </div>
            ))}
          </div>
        </div>
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
