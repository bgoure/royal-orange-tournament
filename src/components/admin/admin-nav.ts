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

export const adminNavGroups = [
  {
    id: "setup",
    label: "Setup",
    items: [
      { href: "/admin/tournament-settings", label: "Tournament Admin", segment: "tournament-settings" },
      { href: "/admin/divisions", label: "Divisions & Pools", segment: "divisions" },
      { href: "/admin/teams", label: "Teams", segment: "teams" },
      { href: "/admin/locations", label: "Locations", segment: "locations" },
      { href: "/admin/fields", label: "Fields", segment: "fields" },
    ],
  },
  {
    id: "ops",
    label: "Competition Ops",
    items: [
      { href: "/admin/games", label: "Games & Schedule", segment: "games" },
      { href: "/admin/standings", label: "Standings", segment: "standings" },
      { href: "/admin/brackets", label: "Brackets & Playoffs", segment: "brackets" },
      { href: "/admin/print-sheets", label: "Print game sheets", segment: "print-sheets" },
    ],
  },
  {
    id: "content",
    label: "Content & Public Site",
    items: [
      { href: "/admin/announcements", label: "Announcements", segment: "announcements" },
      { href: "/admin/faq", label: "FAQ", segment: "faq" },
      { href: "/admin/sponsors", label: "Sponsors", segment: "sponsors" },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { href: "/admin/users", label: "Users & Staff", segment: "users" },
      { href: "/admin", label: "All tournaments", segment: "hub" },
    ],
  },
] as const satisfies readonly AdminNavGroup[];

/** Flat list for callers that still need every link. */
export const adminNavItems: readonly AdminNavItem[] = adminNavGroups.flatMap((g) => [...g.items]);

export function navItemIsActive(pathname: string, href: string, segment: string): boolean {
  if (segment === "hub") {
    return pathname === "/admin" || pathname === "/admin/";
  }
  if (segment === "tournament-settings") {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
