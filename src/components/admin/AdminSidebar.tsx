"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNavItems } from "@/components/admin/admin-nav";

function navItemIsActive(pathname: string, href: string, segment: string): boolean {
  if (segment === "") {
    return pathname === "/admin" || pathname === "/admin/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar() {
  const pathname = usePathname() ?? "";

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-zinc-900 text-zinc-100">
      <div className="border-b border-zinc-700/80 px-5 py-5">
        <Link href="/admin" className="block text-lg font-semibold tracking-tight text-white">
          Tournament Hub
        </Link>
        <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-emerald-400/90">
          Admin
        </p>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3" aria-label="Admin">
        {adminNavItems.map((item) => {
          const active = navItemIsActive(pathname, item.href, item.segment);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-300 hover:bg-zinc-800/60 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-zinc-700/80 p-3">
        <Link
          href="/"
          className="block rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800/60 hover:text-white"
        >
          ← Public site
        </Link>
      </div>
    </aside>
  );
}
