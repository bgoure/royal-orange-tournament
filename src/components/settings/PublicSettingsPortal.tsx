"use client";

import type { Role } from "@prisma/client";
import { signIn, signOut } from "next-auth/react";
import { usePublicSiteTheme } from "@/components/theme/public-site-theme";

const cardClass =
  "rounded-2xl border border-zinc-200/90 bg-white/90 p-4 shadow-sm dark:border-zinc-700/90 dark:bg-zinc-900/60";

const btnPrimary =
  "inline-flex min-h-[40px] items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm transition-colors hover:bg-zinc-50 active:opacity-90 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700";

const btnSecondary =
  "inline-flex min-h-[40px] items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 active:opacity-90 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700";

export function PublicSettingsPortal({
  settingsPath,
  requestOrigin,
  googleAuthConfigured,
  signedIn,
  userLabel,
  role,
}: {
  settingsPath: string;
  requestOrigin: string;
  googleAuthConfigured: boolean;
  signedIn: boolean;
  userLabel: string;
  role: Role;
}) {
  const settingsAbsolute = requestOrigin ? `${requestOrigin}${settingsPath}` : settingsPath;
  const adminHref = requestOrigin ? `${requestOrigin}/admin` : "/admin";
  const canManageTournament = role === "ADMIN";
  const hasQuickEdit = role === "ADMIN" || role === "POWER_USER";
  const { theme, setTheme } = usePublicSiteTheme();

  return (
    <div className="flex flex-col gap-4">
      <section className={cardClass} aria-label="Site appearance">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Theme</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Light or dark appearance for this tournament site.
        </p>
        <div
          className="mt-3 inline-flex rounded-xl border border-zinc-200 p-0.5 dark:border-zinc-600"
          role="group"
          aria-label="Choose theme"
        >
          <button
            type="button"
            className={`min-h-[40px] rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              theme === "light"
                ? "bg-royal text-white shadow-sm"
                : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
            onClick={() => setTheme("light")}
          >
            Light
          </button>
          <button
            type="button"
            className={`min-h-[40px] rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              theme === "dark"
                ? "bg-royal text-white shadow-sm"
                : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
            onClick={() => setTheme("dark")}
          >
            Dark
          </button>
        </div>
      </section>

      <section className={cardClass} aria-label="Staff sign-in">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Admin / Power User Mode</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Login to manage tournament and report results.
        </p>
        {!googleAuthConfigured ? (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            Google sign-in is not configured for this deployment, so staff sign-in cannot be enabled here.
          </p>
        ) : !signedIn ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Sign in with Google to link your session. ADMIN and Power User accounts unlock quick edit on schedule,
              results, and bracket cards.
            </p>
            <button
              type="button"
              className={btnPrimary}
              onClick={() => void signIn("google", { callbackUrl: settingsAbsolute })}
            >
              Login
            </button>
          </div>
        ) : hasQuickEdit ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Signed in as <span className="font-medium text-zinc-900 dark:text-zinc-100">{userLabel}</span> (
              <span className="font-medium text-royal dark:text-royal-200">{role}</span>). Quick edit is enabled on game
              cards.
            </p>
            <button type="button" className={btnSecondary} onClick={() => void signOut({ callbackUrl: settingsAbsolute })}>
              Sign out
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Signed in as <span className="font-medium text-zinc-900 dark:text-zinc-100">{userLabel}</span>. Your role is{" "}
              <span className="font-medium">{role}</span> — quick edit on game cards stays disabled.
            </p>
            <button type="button" className={btnSecondary} onClick={() => void signOut({ callbackUrl: settingsAbsolute })}>
              Sign out
            </button>
          </div>
        )}
      </section>

      <section className={cardClass} aria-label="Tournament administration">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Manage Tournament</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Access Tournament Settings (Approved Admins only)
        </p>
        <div className="mt-3">
          {canManageTournament ? (
            <a href={adminHref} className={`${btnPrimary} w-full sm:w-auto`}>
              Manage Tournament.
            </a>
          ) : (
            <button type="button" disabled className={`${btnPrimary} cursor-not-allowed opacity-60`}>
              Manage Tournament.
            </button>
          )}
          {!canManageTournament ? (
            <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
              Only approved and logged in admins can manage this tournament.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
