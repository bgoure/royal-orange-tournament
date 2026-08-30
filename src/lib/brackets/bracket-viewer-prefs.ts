export type BracketDisplayPrefs = {
  showDateTime: boolean;
  showTeamNames: boolean;
  showLocation: boolean;
  showGameNumber: boolean;
};

export const DEFAULT_BRACKET_DISPLAY_PREFS: BracketDisplayPrefs = {
  showDateTime: true,
  showTeamNames: true,
  showLocation: true,
  showGameNumber: true,
};

export const BRACKET_DISPLAY_COOKIE = "th_bracket_display";
export const BRACKET_ROUNDS_COOKIE = "th_bracket_rounds";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

type StoredDisplay = {
  dt?: boolean;
  tn?: boolean;
  loc?: boolean;
  gn?: boolean;
};

export type StoredRoundFocus = {
  extraOpen: number[];
  forcedCollapsed: number[];
};

function cookieWrite(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

function cookieRead(name: string): string | null {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split("; ");
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq) === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1));
      } catch {
        return part.slice(eq + 1);
      }
    }
  }
  return null;
}

export function parseBracketDisplayPrefs(raw: string | null): BracketDisplayPrefs {
  if (!raw) return { ...DEFAULT_BRACKET_DISPLAY_PREFS };
  try {
    const parsed = JSON.parse(raw) as StoredDisplay;
    return {
      showDateTime: parsed.dt !== false,
      showTeamNames: parsed.tn !== false,
      showLocation: parsed.loc !== false,
      showGameNumber: parsed.gn !== false,
    };
  } catch {
    return { ...DEFAULT_BRACKET_DISPLAY_PREFS };
  }
}

export function readBracketDisplayPrefs(): BracketDisplayPrefs {
  return parseBracketDisplayPrefs(cookieRead(BRACKET_DISPLAY_COOKIE));
}

export function writeBracketDisplayPrefs(prefs: BracketDisplayPrefs) {
  const stored: StoredDisplay = {
    dt: prefs.showDateTime,
    tn: prefs.showTeamNames,
    loc: prefs.showLocation,
    gn: prefs.showGameNumber,
  };
  cookieWrite(BRACKET_DISPLAY_COOKIE, JSON.stringify(stored));
}

function parseRoundFocusMap(raw: string | null): Record<string, StoredRoundFocus> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, { o?: number[]; c?: number[] }>;
    const out: Record<string, StoredRoundFocus> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!key || !value || typeof value !== "object") continue;
      out[key] = {
        extraOpen: Array.isArray(value.o) ? value.o.filter((n) => Number.isInteger(n)) : [],
        forcedCollapsed: Array.isArray(value.c) ? value.c.filter((n) => Number.isInteger(n)) : [],
      };
    }
    return out;
  } catch {
    return {};
  }
}

export function readRoundFocusPrefs(persistKey: string): StoredRoundFocus | null {
  const map = parseRoundFocusMap(cookieRead(BRACKET_ROUNDS_COOKIE));
  return map[persistKey] ?? null;
}

export function writeRoundFocusPrefs(persistKey: string, next: StoredRoundFocus) {
  const map = parseRoundFocusMap(cookieRead(BRACKET_ROUNDS_COOKIE));
  const empty = next.extraOpen.length === 0 && next.forcedCollapsed.length === 0;
  if (empty) delete map[persistKey];
  else map[persistKey] = next;
  cookieWrite(
    BRACKET_ROUNDS_COOKIE,
    JSON.stringify(
      Object.fromEntries(
        Object.entries(map).map(([key, value]) => [key, { o: value.extraOpen, c: value.forcedCollapsed }]),
      ),
    ),
  );
}
