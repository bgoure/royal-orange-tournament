import Link from "next/link";
import { PageTitle } from "@/components/ui/PublicHeading";

const CogIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5" aria-hidden>
    <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 009 14.4a1.65 1.65 0 00-1-1.51V12a2 2 0 012-2h.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V15z" />
  </svg>
);

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <PageTitle>Settings</PageTitle>
        <p className="mt-2 text-sm text-zinc-600">Preferences for the tournament tracker app.</p>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 border-b-2 border-royal pb-2 text-base font-bold uppercase tracking-[0.05em] text-royal">
          Display
        </h2>
        <p className="text-sm text-zinc-600">
          Times follow your device timezone. Tournament dates use the schedule published by the organizer.
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 border-b-2 border-royal pb-2 text-base font-bold uppercase tracking-[0.05em] text-royal">
          Notifications
        </h2>
        <p className="text-sm text-zinc-600">Email notifications are not configured in this public build.</p>
      </section>

      <section
        className="rounded-2xl border border-dashed border-zinc-200/90 bg-zinc-100/80 p-4 shadow-inner"
        aria-label="Staff access"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-zinc-400" aria-hidden>
            <CogIcon />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Staff</p>
            <p className="mt-1 text-sm text-zinc-500">
              Directors and scorekeepers: open the admin portal to manage schedules, teams, and results (sign-in
              required).
            </p>
            <Link
              href="/admin"
              className="mt-3 inline-flex min-h-[40px] items-center rounded-lg border border-zinc-200/90 bg-white/70 px-3 py-2 text-sm text-zinc-600 shadow-sm transition-colors hover:border-zinc-300 hover:bg-white hover:text-zinc-800 active:opacity-90"
            >
              Open admin portal
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
