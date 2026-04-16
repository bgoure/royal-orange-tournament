import Link from "next/link";
import { tournamentPath } from "@/lib/tournament-public-path";

const CogIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-5" aria-hidden>
    <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 009 14.4a1.65 1.65 0 00-1-1.51V12a2 2 0 012-2h.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0014.4 15V15z" />
  </svg>
);

export default async function MorePage({ params }: { params: Promise<{ tournamentSlug: string }> }) {
  const { tournamentSlug } = await params;
  const tp = (s: string) => tournamentPath(tournamentSlug, s);

  const links = [
    { href: tp("locations"), label: "Locations", description: "Venues & maps" },
    { href: tp("faq"), label: "FAQ", description: "Answers to common questions" },
    { href: tp("settings"), label: "Settings", description: "App preferences" },
    { href: tp("social"), label: "Social", description: "Follow Baseball Milton" },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">More</h1>
        <p className="text-sm text-zinc-600">Quick links and resources.</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {links.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex min-h-[52px] flex-col justify-center rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition-colors active:scale-[0.99] hover:border-royal-200"
            >
              <span className="font-semibold text-zinc-900">{item.label}</span>
              <span className="text-xs text-zinc-500">{item.description}</span>
            </Link>
          </li>
        ))}
      </ul>

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
              Directors and scorekeepers: open the admin portal (sign-in required). You can also reach this from
              Settings.
            </p>
            <Link
              href="/admin"
              className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-zinc-200/90 bg-white/70 px-3 py-2 text-sm font-medium text-zinc-600 shadow-sm transition-colors hover:border-zinc-300 hover:bg-white hover:text-zinc-800 active:opacity-90 sm:w-auto"
            >
              Open admin portal
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
