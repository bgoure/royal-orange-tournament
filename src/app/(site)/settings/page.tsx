import Link from "next/link";

const CogIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5" aria-hidden>
    <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 009 14.4a1.65 1.65 0 00-1-1.51V12a2 2 0 012-2h.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V15z" />
  </svg>
);

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Settings</h1>
        <p className="text-sm text-zinc-600">Preferences for the tournament tracker app.</p>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Display</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Times follow your device timezone. Tournament dates use the schedule published by the organizer.
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Notifications</h2>
        <p className="mt-1 text-sm text-zinc-600">Email notifications are not configured in this public build.</p>
      </section>

      <div className="border-t border-zinc-200 pt-6">
        <Link
          href="/admin"
          className="flex min-h-[44px] items-center gap-3 rounded-lg px-4 py-3 text-sm text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700 active:opacity-90"
        >
          <span className="text-zinc-400">
            <CogIcon />
          </span>
          <span>Admin Portal</span>
        </Link>
      </div>
    </div>
  );
}
