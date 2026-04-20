"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "ro-classic-pwa-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone);
}

function isIosLike(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function PwaInstallPrompt() {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, [mounted]);

  const onDismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore quota / private mode */
    }
    setDismissed(true);
  }, []);

  const onInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } catch {
      /* user dismissed native UI or prompt failed */
    } finally {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  if (!mounted) return null;
  if (isStandalone()) return null;
  if (dismissed) return null;
  try {
    if (localStorage.getItem(STORAGE_KEY)) return null;
  } catch {
    /* treat as not dismissed */
  }

  if (deferredPrompt) {
    return (
      <div
        className="border-b border-royal-200 bg-royal-50 px-4 py-3 text-royal-900 shadow-sm"
        role="region"
        aria-label="Install app"
      >
        <div className="mx-auto flex max-w-5xl items-start gap-3">
          <p className="min-w-0 flex-1 text-sm leading-snug">
            Install Royal & Orange Classic on your home screen for the best experience.
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onInstall}
              className="min-h-10 rounded-lg bg-royal px-3 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-95"
              aria-label="Install app"
            >
              Install
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="min-h-10 min-w-10 rounded-lg p-2 text-royal-900/80 transition-colors hover:bg-royal-100"
              aria-label="Dismiss install prompt"
            >
              <span aria-hidden className="text-lg leading-none">
                ×
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isIosLike()) {
    return (
      <div
        className="border-b border-royal-200 bg-royal-50 px-4 py-3 text-royal-900 shadow-sm"
        role="region"
        aria-label="Install app"
      >
        <div className="mx-auto flex max-w-5xl items-start gap-3">
          <p className="min-w-0 flex-1 text-sm leading-snug">
            Install Royal & Orange Classic on your home screen for the best experience. Tap{" "}
            <strong className="font-semibold">Share</strong>, then <strong className="font-semibold">Add to Home Screen</strong>.
          </p>
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-10 min-w-10 shrink-0 rounded-lg p-2 text-royal-900/80 transition-colors hover:bg-royal-100"
            aria-label="Dismiss install prompt"
          >
            <span aria-hidden className="text-lg leading-none">
              ×
            </span>
          </button>
        </div>
      </div>
    );
  }

  return null;
}
