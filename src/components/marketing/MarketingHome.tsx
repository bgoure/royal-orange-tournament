import Link from "next/link";
import { tournamentPublicBasePath } from "@/lib/tournament-public-path";

export type DirectoryTournament = {
  id: string;
  name: string;
  slug: string;
  shortLabel: string | null;
  locationLabel: string | null;
  startDate: Date;
  endDate: Date;
  archiveFolder: string | null;
  archivedAt: Date | null;
};

function formatEventDates(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" };
  const a = start.toLocaleDateString("en-CA", opts);
  const b = end.toLocaleDateString("en-CA", opts);
  return a === b ? a : `${a} – ${b}`;
}

export function MarketingHome({ tournaments }: { tournaments: DirectoryTournament[] }) {
  const now = Date.now();
  const upcoming = tournaments.filter((t) => t.endDate.getTime() >= now - 24 * 60 * 60 * 1000);
  const recentPast = tournaments.filter((t) => t.endDate.getTime() < now - 24 * 60 * 60 * 1000);

  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900">
      <header className="relative isolate min-h-[100svh] overflow-hidden bg-royal-900 text-white">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,rgba(234,88,12,0.35),transparent_55%),radial-gradient(ellipse_at_80%_70%,rgba(30,58,138,0.9),transparent_50%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
          aria-hidden
        />

        <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-5xl flex-col px-5 pb-16 pt-8 sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium tracking-wide text-accent-100">Tournament Hub</p>
            <Link
              href="/login"
              className="rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              Organizer sign in
            </Link>
          </div>

          <div className="mt-auto flex max-w-xl flex-col gap-5 pb-8 pt-24 sm:pt-32">
            <h1 className="font-[family-name:var(--font-geist-sans)] text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl">
              Tournament Hub
            </h1>
            <p className="max-w-md text-base leading-relaxed text-royal-100 sm:text-lg">
              Live schedules, scores, and brackets for youth sports — built for organizers and parents on game day.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href="#tournaments"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-5 text-sm font-semibold text-white shadow-lg shadow-accent/30 transition hover:bg-accent-700"
              >
                Find your tournament
              </a>
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/30 px-5 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Run an event
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section id="tournaments" className="scroll-mt-8 border-t border-zinc-200 bg-gradient-to-b from-royal-50/80 to-zinc-50">
        <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
          <h2 className="text-2xl font-semibold tracking-tight text-royal-900 sm:text-3xl">Tournaments</h2>
          <p className="mt-2 max-w-xl text-sm text-zinc-600 sm:text-base">
            Open a live event for schedules, scores, and brackets. No app install required.
          </p>

          {upcoming.length === 0 && recentPast.length === 0 ? (
            <p className="mt-10 text-sm text-zinc-600">
              No published tournaments yet. Organizers can publish from the{" "}
              <Link href="/login" className="font-medium text-royal underline-offset-2 hover:underline">
                admin portal
              </Link>
              .
            </p>
          ) : null}

          {upcoming.length > 0 ? (
            <ul className="mt-10 divide-y divide-zinc-200/80 border-y border-zinc-200/80">
              {upcoming.map((t) => {
                const href = tournamentPublicBasePath(t);
                return (
                  <li key={t.id}>
                    <Link
                      href={href}
                      className="group flex flex-col gap-1 py-5 transition sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
                    >
                      <span className="text-lg font-semibold text-zinc-900 group-hover:text-royal">
                        {t.shortLabel?.trim() || t.name}
                      </span>
                      <span className="flex shrink-0 flex-col text-sm text-zinc-500 sm:items-end">
                        <span>{formatEventDates(t.startDate, t.endDate)}</span>
                        {t.locationLabel ? <span className="text-zinc-400">{t.locationLabel}</span> : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {recentPast.length > 0 ? (
            <div className="mt-14">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Recently finished</h3>
              <ul className="mt-4 divide-y divide-zinc-200/60">
                {recentPast.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={tournamentPublicBasePath(t)}
                      className="flex flex-col gap-0.5 py-3 text-sm text-zinc-600 transition hover:text-royal sm:flex-row sm:items-baseline sm:justify-between"
                    >
                      <span className="font-medium">{t.shortLabel?.trim() || t.name}</span>
                      <span className="text-zinc-400">{formatEventDates(t.startDate, t.endDate)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      <footer className="border-t border-zinc-200 bg-white py-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-5 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>Tournament Hub</p>
          <Link href="/login" className="font-medium text-royal hover:underline">
            Organizer sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
