"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ScrollDirection = "up" | "down" | null;

export function useScrollDirection({
  thresholdDown = 10,
  thresholdUp = 5,
  enabled = true,
}: {
  thresholdDown?: number;
  thresholdUp?: number;
  enabled?: boolean;
} = {}): ScrollDirection {
  const [direction, setDirection] = useState<ScrollDirection>(null);
  const lastY = useRef(0);
  const ticking = useRef(false);

  const update = useCallback(() => {
    const y = window.scrollY;
    const delta = y - lastY.current;

    if (delta > thresholdDown) {
      setDirection("down");
      lastY.current = y;
    } else if (delta < -thresholdUp) {
      setDirection("up");
      lastY.current = y;
    }

    if (y <= 0) {
      setDirection(null);
    }

    ticking.current = false;
  }, [thresholdDown, thresholdUp]);

  useEffect(() => {
    if (!enabled) return;

    lastY.current = window.scrollY;

    const onScroll = () => {
      if (!ticking.current) {
        ticking.current = true;
        requestAnimationFrame(update);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [enabled, update]);

  return enabled ? direction : null;
}
