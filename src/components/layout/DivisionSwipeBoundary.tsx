"use client";

import { useCallback, useRef, useTransition, type ReactNode } from "react";
import { useSwipeable } from "react-swipeable";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { setSelectedDivisionTabId } from "@/app/actions/tournament";
import { DIVISION_SWIPE_IGNORE_SELECTOR } from "@/lib/division-swipe-ignore";
import { isDivisionTabBasePath } from "@/lib/tournament-public-path";

function touchTargetElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  if (target instanceof Text && target.parentElement) return target.parentElement;
  return null;
}

type Props = {
  tournamentSlug: string;
  /** Same order as header division tabs (`buildDivisionTabDescriptors`). */
  divisionIdsOrdered: string[];
  defaultDivisionId: string;
  children: ReactNode;
};

/**
 * Horizontal swipe to move between divisions on tabbed tournament routes.
 * Touch only (`trackMouse: false`) to avoid fighting desktop text selection.
 * Large `delta` reduces accidental navigation while scrolling vertically.
 */
export function DivisionSwipeBoundary({
  tournamentSlug,
  divisionIdsOrdered,
  defaultDivisionId,
  children,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  /** Touch started inside a horizontal scroller (game row, tabs, etc.); skip division change. */
  const swipeStartedInScrollRef = useRef(false);

  const navigateToDivision = useCallback(
    (id: string) => {
      startTransition(async () => {
        await setSelectedDivisionTabId(id, tournamentSlug);
        const p = new URLSearchParams(searchParams.toString());
        p.set("division", id);
        const qs = p.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams, tournamentSlug],
  );

  const go = useCallback(
    (dir: 1 | -1) => {
      if (pending || divisionIdsOrdered.length < 2) return;
      if (!isDivisionTabBasePath(pathname, tournamentSlug)) return;

      const raw = searchParams.get("division");
      const current = raw && divisionIdsOrdered.includes(raw) ? raw : defaultDivisionId;
      const idx = divisionIdsOrdered.indexOf(current);
      if (idx < 0) return;

      const nextIdx = (idx + dir + divisionIdsOrdered.length) % divisionIdsOrdered.length;
      const nextId = divisionIdsOrdered[nextIdx];
      if (nextId == null || nextId === current) return;
      navigateToDivision(nextId);
    },
    [
      defaultDivisionId,
      divisionIdsOrdered,
      navigateToDivision,
      pathname,
      pending,
      searchParams,
      tournamentSlug,
    ],
  );

  const swipeHandlers = useSwipeable({
    onSwipeStart: ({ event }) => {
      const raw = "target" in event ? event.target : null;
      const el = touchTargetElement(raw);
      swipeStartedInScrollRef.current =
        el != null && el.closest(DIVISION_SWIPE_IGNORE_SELECTOR) != null;
    },
    onSwipedLeft: () => {
      const skip = swipeStartedInScrollRef.current;
      swipeStartedInScrollRef.current = false;
      if (skip) return;
      go(1);
    },
    onSwipedRight: () => {
      const skip = swipeStartedInScrollRef.current;
      swipeStartedInScrollRef.current = false;
      if (skip) return;
      go(-1);
    },
    delta: 70,
    preventScrollOnSwipe: false,
    trackTouch: true,
    trackMouse: false,
    touchEventOptions: { passive: true },
  });

  if (divisionIdsOrdered.length < 2) {
    return <>{children}</>;
  }

  return (
    <div {...swipeHandlers} className="min-w-0">
      {children}
    </div>
  );
}
