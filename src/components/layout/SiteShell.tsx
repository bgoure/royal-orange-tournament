import { SiteHeader, type HeaderTournament } from "@/components/layout/SiteHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { getHeadquartersLocation } from "@/lib/services/content";
import { formatLocationAddress } from "@/lib/location-utils";
import { getTournamentForRequest } from "@/lib/tournament-context";

export async function SiteShell({ children }: { children: React.ReactNode }) {
  const tournament = await getTournamentForRequest();

  let headerTournament: HeaderTournament | null = null;
  if (tournament) {
    const hq = await getHeadquartersLocation(tournament.id);
    headerTournament = {
      name: tournament.name,
      logoUrl: tournament.logoUrl,
      hqLat: hq?.latitude ?? tournament.latitude ?? null,
      hqLon: hq?.longitude ?? tournament.longitude ?? null,
      hqQuery: hq ? (formatLocationAddress(hq) || hq.name) : tournament.locationLabel,
    };
  }

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader tournament={headerTournament} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 pb-24 md:pb-6">{children}</main>
      <footer className="hidden border-t border-zinc-200 py-6 text-center text-xs text-zinc-500 md:block">
        Royal &amp; Orange 2026 — schedules, scores, and brackets
      </footer>
      <BottomNav />
    </div>
  );
}
