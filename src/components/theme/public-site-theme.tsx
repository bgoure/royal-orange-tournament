"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const STORAGE_KEY = "ro-public-theme";

export type PublicSiteTheme = "light" | "dark";

type PublicSiteThemeContextValue = {
  theme: PublicSiteTheme;
  setTheme: (t: PublicSiteTheme) => void;
};

const PublicSiteThemeContext = createContext<PublicSiteThemeContextValue | null>(null);

export function usePublicSiteTheme(): PublicSiteThemeContextValue {
  const ctx = useContext(PublicSiteThemeContext);
  if (!ctx) {
    throw new Error("usePublicSiteTheme must be used within PublicSiteThemeRoot");
  }
  return ctx;
}

let themeStoreVersion = 0;
const themeListeners = new Set<() => void>();

function readStoredTheme(): PublicSiteTheme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* ignore */
  }
  return "light";
}

function subscribeThemeStore(onChange: () => void) {
  themeListeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    themeListeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getThemeSnapshot(): PublicSiteTheme {
  void themeStoreVersion;
  return readStoredTheme();
}

function getServerThemeSnapshot(): PublicSiteTheme {
  return "light";
}

function emitThemeStoreChange() {
  themeStoreVersion += 1;
  themeListeners.forEach((l) => l());
}

export function PublicSiteThemeRoot({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribeThemeStore, getThemeSnapshot, getServerThemeSnapshot);

  const setTheme = useCallback((t: PublicSiteTheme) => {
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
    emitThemeStoreChange();
  }, []);

  return (
    <PublicSiteThemeContext.Provider value={{ theme, setTheme }}>
      <div className={theme === "dark" ? "dark" : ""}>{children}</div>
    </PublicSiteThemeContext.Provider>
  );
}
