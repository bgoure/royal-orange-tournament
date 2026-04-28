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
import { isDivisionTabBasePath } from "@/lib/tournament-public-path";
import { DIVISION_SWIPE_IGNORE } from "@/lib/division-swipe-ignore";

const pillBase =
  "shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-200 snap-start min-h-[40px]";
const pillActive =
  "bg-white text-royal shadow-sm";
const pillInactive =
  "bg-white/15 text-white/80 hover:bg-white/25 hover:text-white";

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

  useEffect(() => {
    if (tabs.length < 2) return;
    const idx = tabs.findIndex((d) => d.id === selectedDivision);
    if (idx < 0) return;
    const el = pillRefs.current[idx];
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [tabs, selectedDivision]);

  if (!showPills) return null;

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
    <div
      ref={scrollRef}
      {...{ [DIVISION_SWIPE_IGNORE]: "" }}
      className="no-scrollbar flex max-w-[7rem] gap-1.5 overflow-x-auto scroll-smooth snap-x snap-mandatory sm:max-w-[12rem] md:max-w-none md:overflow-x-visible md:snap-none"
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
            className={`${pillBase} ${active ? pillActive : pillInactive}`}
          >
            {d.name}
          </button>
        );
      })}
    </div>
  );
}
