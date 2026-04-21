"use client";

import type { Role } from "@prisma/client";
import Link from "next/link";
import { signIn, signOut } from "next-auth/react";

const CogIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5" aria-hidden>
    <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 009 14.4a1.65 1.65 0 00-1-1.51V12a2 2 0 012-2h.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 15z" />
  </svg>
);

export function PublicSettingsStaffAuth({
  tournamentSlug,
  googleAuthConfigured,
  signedIn,
  userLabel,
  role,
}: {
  tournamentSlug: string;
  googleAuthConfigured: boolean;
  signedIn: boolean;
  userLabel: string;
  role: Role;
}) {
  const settingsUrl = `/${tournamentSlug}/settings`;
  const isAdmin = role === "ADMIN";

  return (
    <section
      className="rounded-2xl border border-dashed border-zinc-200/90 bg-zinc-100/80 p-4 shadow-inner"
      aria-label="Staff access and quick scoring"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-zinc-400" aria-hidden>
          <CogIcon />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Staff</p>
            <p className="mt-1 text-sm text-zinc-600">
              Directors and scorekeepers can use the admin portal for full scheduling and roster tools. Tournament{" "}
              <span className="font-medium text-zinc-800">ADMIN</span> accounts can also tap game cards on this public
              site to quick-edit field, time, status, and runs.
            </p>
            <Link
              href="/admin"
              className="mt-3 inline-flex min-h-[40px] items-center rounded-lg border border-zinc-200/90 bg-white/70 px-3 py-2 text-sm text-zinc-600 shadow-sm transition-colors hover:border-zinc-300 hover:bg-white hover:text-zinc-800 active:opacity-90"
            >
              Open admin portal
            </Link>
          </div>

          <div className="border-t border-zinc-200/80 pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Admin mode on this site</p>
            {!googleAuthConfigured ? (
              <p className="mt-1 text-sm text-zinc-500">
                Google sign-in is not configured for this deployment, so quick scoring from the public site cannot be
                enabled here.
              </p>
            ) : !signedIn ? (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-zinc-600">Sign in with Google to link your session. Only ADMIN users unlock
                  quick edit on schedule, results, and bracket cards.</p>
                <button
                  type="button"
                  className="inline-flex min-h-[40px] items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm transition-colors hover:bg-zinc-50 active:opacity-90"
                  onClick={() => void signIn("google", { callbackUrl: settingsUrl })}
                >
                  Sign in with Google
                </button>
              </div>
            ) : isAdmin ? (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-zinc-700">
                  Signed in as <span className="font-medium text-zinc-900">{userLabel}</span> (
                  <span className="font-medium text-royal">ADMIN</span>). Quick edit is enabled on game cards.
                </p>
                <button
                  type="button"
                  className="inline-flex min-h-[40px] items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 active:opacity-90"
                  onClick={() => void signOut({ callbackUrl: settingsUrl })}
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-zinc-600">
                  Signed in as <span className="font-medium text-zinc-900">{userLabel}</span>. Your role is{" "}
                  <span className="font-medium">{role}</span>, not ADMIN — quick edit on game cards stays disabled.
                </p>
                <button
                  type="button"
                  className="inline-flex min-h-[40px] items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 active:opacity-90"
                  onClick={() => void signOut({ callbackUrl: settingsUrl })}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
