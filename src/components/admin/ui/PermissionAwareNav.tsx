"use client";

import Link from "next/link";
import type { Role } from "@prisma/client";
import { navItemIsActive } from "@/components/admin/admin-nav";
import { filterAdminNavForRole } from "@/lib/rbac/admin-nav-permissions";

type Props = {
  role: Role | null | undefined;
  pathname: string;
  /** Query string used for mode-aware active state (e.g. scorekeeper). */
  search?: string;
  /** Rewrites each href, e.g. to route through the tournament select handler. */
  buildHref?: (href: string) => string;
  onNavigate?: () => void;
  ariaLabel?: string;
  className?: string;
};

/**
 * Renders the grouped admin nav for a role. Items the role cannot open are
 * never rendered — `filterAdminNavForRole` is the single source of truth.
 */
export function PermissionAwareNav({
  role,
  pathname,
  search = "",
  buildHref,
  onNavigate,
  ariaLabel = "Admin",
  className = "flex flex-1 flex-col gap-4 overflow-y-auto p-3",
}: Props) {
  const groups = filterAdminNavForRole(role);

  return (
    <nav className={className} aria-label={ariaLabel}>
      {groups.map((group) => (
        <div key={group.id}>
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {group.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = navItemIsActive(pathname, item.href, item.segment, search);
              const href = buildHref ? buildHref(item.href) : item.href;
              return (
                <Link
                  key={`${group.id}:${item.segment}`}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => onNavigate?.()}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-zinc-800 text-white shadow-sm"
                      : "text-zinc-300 hover:bg-zinc-800/60 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
