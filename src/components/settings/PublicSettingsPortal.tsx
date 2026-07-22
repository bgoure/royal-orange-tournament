"use client";

import { useState } from "react";
import type { Role } from "@prisma/client";
import { signIn, signOut } from "next-auth/react";
import { usePublicSiteTheme } from "@/components/theme/public-site-theme";
import { publicGlassCard2xl } from "@/lib/public-glass-card";
import { BracketRoundRobinProgress } from "@/components/settings/BracketRoundRobinProgress";
import type { BracketProgressForPublicSettings } from "@/lib/services/bracket-public-settings";

const cardClass = `${publicGlassCard2xl} p-4`;

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
  tournamentId,
  showBracketProgressSection,
  bracketProgressRows,
}: {
  settingsPath: string;
  requestOrigin: string;
  googleAuthConfigured: boolean;
  signedIn: boolean;
  userLabel: string;
  role: Role;
  tournamentId: string;
  showBracketProgressSection: boolean;
  bracketProgressRows: BracketProgressForPublicSettings[];
}) {
  const settingsAbsolute = requestOrigin ? `${requestOrigin}${settingsPath}` : settingsPath;
  const adminHref = requestOrigin ? `${requestOrigin}/admin` : "/admin";
  const canManageTournament = role === "ADMIN";
  const hasQuickEdit = role === "ADMIN" || role === "POWER_USER";
  const { theme, setTheme } = usePublicSiteTheme();
  const [staffOpen, setStaffOpen] = useState(hasQuickEdit || signedIn);

  return (
    <div className="flex flex-col gap-4">
      <section className={cardClass} aria-label="Appearance">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Appearance</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Choose light or dark for this tournament site on this device.
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

      <section className={cardClass} aria-label="Staff tools">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-left"
          aria-expanded={staffOpen}
          onClick={() => setStaffOpen((o) => !o)}
        >
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Staff tools</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              For directors and scorekeepers — parents can ignore this section.
            </p>
          </div>
          <span className="shrink-0 text-xs font-semibold text-zinc-500" aria-hidden>
            {staffOpen ? "Hide" : "Show"}
          </span>
        </button>

        {staffOpen ? (
          <div className="mt-4 space-y-4 border-t border-zinc-200 pt-4 dark:border-zinc-600">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Sign in</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Staff accounts unlock quick edit on schedule, results, and brackets.
              </p>
              {!googleAuthConfigured ? (
                <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                  Google sign-in is not configured for this deployment, so staff sign-in cannot be enabled here.
                </p>
              ) : !signedIn ? (
                <div className="mt-3 space-y-2">
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={() => void signIn("google", { callbackUrl: settingsAbsolute })}
                  >
                    Sign in with Google
                  </button>
                </div>
              ) : hasQuickEdit ? (
                <div className="mt-3 space-y-2">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    Signed in as <span className="font-medium text-zinc-900 dark:text-zinc-100">{userLabel}</span> (
                    <span className="font-medium text-royal dark:text-royal-200">{role}</span>). Quick edit is enabled on
                    game cards.
                  </p>
                  <button type="button" className={btnSecondary} onClick={() => void signOut({ callbackUrl: "/" })}>
                    Sign out
                  </button>
                  {showBracketProgressSection ? (
                    <div className="border-t border-zinc-200 pt-4 dark:border-zinc-600">
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Playoff bracket</h3>
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        For pool-seeded brackets, push standings into Round 1 when pool play is done, or reset to TBD.
                        Creating the bracket (format, pairing style, assign teams vs pool seeds) is under{" "}
                        {canManageTournament ? (
                          <a href={adminHref} className="font-medium text-royal underline-offset-2 hover:underline">
                            Tournament Admin → Brackets
                          </a>
                        ) : (
                          <span className="font-medium text-zinc-800 dark:text-zinc-200">
                            Tournament Admin → Brackets
                          </span>
                        )}
                        .
                      </p>
                      {bracketProgressRows.length === 0 ? (
                        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                          {role === "POWER_USER" ? (
                            <>
                              No playoff bracket found for your assigned division(s) in this tournament, or pool play is
                              not set up yet. Ask an admin to create the bracket if needed.
                            </>
                          ) : (
                            <>
                              No playoff bracket exists for this tournament yet. Create one in Tournament Admin →
                              Brackets.
                            </>
                          )}
                        </p>
                      ) : (
                        <BracketRoundRobinProgress tournamentId={tournamentId} rows={bracketProgressRows} />
                      )}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Signed in as <span className="font-medium text-zinc-900 dark:text-zinc-100">{userLabel}</span>. Your
                    role is <span className="font-medium">{role}</span> — quick edit on game cards stays disabled.
                  </p>
                  <button type="button" className={btnSecondary} onClick={() => void signOut({ callbackUrl: "/" })}>
                    Sign out
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-zinc-200 pt-4 dark:border-zinc-600">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Manage tournament</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Full admin portal (approved admins only).
              </p>
              <div className="mt-3">
                {canManageTournament ? (
                  <a href={adminHref} className={`${btnPrimary} w-full sm:w-auto`}>
                    Open admin portal
                  </a>
                ) : (
                  <button type="button" disabled className={`${btnPrimary} cursor-not-allowed opacity-60`}>
                    Open admin portal
                  </button>
                )}
                {!canManageTournament ? (
                  <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
                    Only approved and logged-in admins can manage this tournament.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
