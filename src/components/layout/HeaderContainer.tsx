"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { useScrollDirection } from "@/hooks/useScrollDirection";

function subscribeMediaQuery(callback: () => void) {
  const mq = window.matchMedia("(max-width: 1023px)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getIsMobile() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 1023px)").matches;
}

function getIsMobileServer() {
  return false;
}

export function HeaderContainer({
  children,
}: {
  children: ReactNode;
}) {
  const isMobile = useSyncExternalStore(subscribeMediaQuery, getIsMobile, getIsMobileServer);

  const scrollDirection = useScrollDirection({
    thresholdDown: 10,
    thresholdUp: 5,
    enabled: isMobile,
  });

  const hidden = scrollDirection === "down";

  return (
    <div
      className="sticky top-0 z-40 transition-transform duration-300 ease-in-out will-change-transform"
      style={{
        transform: hidden ? "translateY(-100%)" : "translateY(0)",
      }}
    >
      {children}
    </div>
  );
}
