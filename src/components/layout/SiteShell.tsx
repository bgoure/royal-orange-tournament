import { SiteHeader } from "@/components/layout/SiteHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { getDivisionTabCookie } from "@/lib/division-tab-cookie";
import { buildDivisionTabDescriptors } from "@/lib/division-tabs";
import { listPoolsForDivisionTabs } from "@/lib/services/pools";
import { getTournamentForRequest } from "@/lib/tournament-context";

export async function SiteShell({ children }: { children: React.ReactNode }) {
  const tournament = await getTournamentForRequest();

  const [divisionTabDescriptors, cookieDivision] = tournament
    ? await Promise.all([
        listPoolsForDivisionTabs(tournament.id).then(buildDivisionTabDescriptors),
        getDivisionTabCookie(),
      ])
    : [[], null as string | null];

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader divisionTabDescriptors={divisionTabDescriptors} cookieDivision={cookieDivision} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 pb-24 md:pb-6">{children}</main>
      <footer className="hidden border-t border-zinc-200 py-6 text-center text-xs text-zinc-500 md:block">
        Royal &amp; Orange 2026 — schedules, scores, and brackets
      </footer>
      <BottomNav />
    </div>
  );
}
