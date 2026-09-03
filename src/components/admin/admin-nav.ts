export type AdminNavItem = {
  href: string;
  label: string;
  segment: string;
};

export type AdminNavGroup = {
  id: string;
  label: string;
  items: readonly AdminNavItem[];
};

/**
 * Grouped by the order a director actually works: see where things stand,
 * build the event, schedule it, run game day, then publish and administer.
 * Items whose href carries a `#` are shortcuts into a page owned by another
 * item — they never take the active state (see `navItemIsActive`).
 */
export const adminNavGroups = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { href: "/admin", label: "All tournaments", segment: "hub" },
      {
        href: "/admin/tournament-settings#setup-progress",
        label: "Setup progress",
        segment: "setup-progress",
      },
      {
        href: "/admin/tournament-settings#publish-tournament",
        label: "Publishing",
        segment: "publish-status",
      },
    ],
  },
  {
    id: "build",
    label: "Build",
    items: [
      {
        href: "/admin/tournament-settings#tournament-info",
        label: "Tournament info",
        segment: "tournament-info",
      },
      { href: "/admin/divisions", label: "Divisions & pools", segment: "divisions" },
      { href: "/admin/teams", label: "Teams", segment: "teams" },
      { href: "/admin/locations", label: "Locations", segment: "locations" },
      { href: "/admin/fields", label: "Fields", segment: "fields" },
      { href: "/admin/structure", label: "Format & structure", segment: "structure" },
      { href: "/admin/standings", label: "Standings rules", segment: "standings" },
    ],
  },
  {
    id: "schedule",
    label: "Schedule",
    items: [
      { href: "/admin/games", label: "Games & schedule", segment: "games" },
      { href: "/admin/brackets", label: "Brackets & playoffs", segment: "brackets" },
    ],
  },
  {
    id: "game-day",
    label: "Game Day",
    items: [
      { href: "/admin/games?mode=scorekeeper", label: "Scorekeeper", segment: "games-scorekeeper" },
      { href: "/admin/announcements", label: "Announcements", segment: "announcements" },
      { href: "/admin/print-sheets", label: "Print game sheets", segment: "print-sheets" },
    ],
  },
  {
    id: "publish-settings",
    label: "Publish & Settings",
    items: [
      { href: "/admin/tournament-settings", label: "Tournament Admin", segment: "tournament-settings" },
      { href: "/admin/faq", label: "FAQ", segment: "faq" },
      { href: "/admin/sponsors", label: "Sponsors", segment: "sponsors" },
      { href: "/admin/users", label: "Users & Staff", segment: "users" },
      {
        href: "/admin/tournament-settings#danger-zone",
        label: "Archive & danger zone",
        segment: "tournament-archive",
      },
    ],
  },
] as const satisfies readonly AdminNavGroup[];

/** Flat list for callers that still need every link. */
export const adminNavItems: readonly AdminNavItem[] = adminNavGroups.flatMap((g) => [...g.items]);

export function navItemIsActive(
  pathname: string,
  href: string,
  segment: string,
  search = "",
): boolean {
  // Anchor shortcuts share a route with a canonical item; only that one lights up.
  if (href.includes("#")) return false;
  const mode = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("mode");
  if (segment === "games-scorekeeper") {
    return pathname === "/admin/games" || pathname.startsWith("/admin/games/")
      ? mode === "scorekeeper"
      : false;
  }
  if (segment === "games") {
    if (pathname === "/admin/games" || pathname.startsWith("/admin/games/")) {
      return mode !== "scorekeeper";
    }
    return false;
  }
  if (segment === "hub") {
    return pathname === "/admin" || pathname === "/admin/";
  }
  if (segment === "tournament-settings") {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  const pathOnly = href.split("?")[0] ?? href;
  return pathname === pathOnly || pathname.startsWith(`${pathOnly}/`);
}
