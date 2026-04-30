import type { ReactNode } from "react";
import { brandCardGradientClass } from "@/lib/brand-card-gradient";
import type { PoolForDivisionTabs } from "@/lib/division-tabs";
import { countSponsorsForTournament, listSponsorsForMarquee } from "@/lib/services/sponsors";
import { sponsorLogoUrl } from "@/lib/sponsor-logo";

const PLACEHOLDER_IDS = [0, 1, 2, 3, 4] as const;

function PlaceholderSlot({ seed }: { seed: string }) {
  return (
    <div
      className={`flex h-16 w-28 shrink-0 items-center justify-center rounded-xl border border-white/35 px-4 shadow-[0_8px_30px_rgb(0,0,0,0.06)] backdrop-blur-md dark:border-zinc-600/50 ${brandCardGradientClass(seed)} dark:bg-none dark:bg-zinc-900/75 dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]`}
      aria-hidden
    >
      <span className="text-[2.5rem] leading-none select-none">⚾</span>
    </div>
  );
}

function SponsorMarqueeShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <section
      className="border-t border-zinc-200/90 pt-5 dark:border-zinc-800/90"
      aria-labelledby="sponsor-marquee-heading"
    >
      <h2
        id="sponsor-marquee-heading"
        className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400"
      >
        Sponsors
      </h2>
      <div className="-mx-4 overflow-hidden px-4 md:mx-0 md:px-0">
        <div className="sponsor-marquee-track flex w-max gap-6 md:gap-10">{children}</div>
      </div>
    </section>
  );
}

function SponsorMarqueePlaceholders() {
  const loop = [...PLACEHOLDER_IDS, ...PLACEHOLDER_IDS];
  return (
    <SponsorMarqueeShell>
      {loop.map((id, i) => (
        <PlaceholderSlot key={`${id}-${i}`} seed={`sponsor-ph-${id}-${i}`} />
      ))}
    </SponsorMarqueeShell>
  );
}

function SponsorMarqueeImages({ sponsors }: { sponsors: { id: string; updatedAt: Date }[] }) {
  const loop = [...sponsors, ...sponsors];
  return (
    <SponsorMarqueeShell>
      {loop.map((s, i) => (
        <div
          key={`${s.id}-${i}`}
          className={`flex h-16 w-28 shrink-0 items-center justify-center rounded-xl border border-white/35 px-2 shadow-[0_8px_30px_rgb(0,0,0,0.06)] backdrop-blur-md dark:border-zinc-600/50 ${brandCardGradientClass(s.id)} dark:bg-none dark:bg-zinc-900/75 dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]`}
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- API-served logo bytes */}
          <img
            src={sponsorLogoUrl(s.id, s.updatedAt)}
            alt=""
            className="max-h-14 max-w-full object-contain"
          />
        </div>
      ))}
    </SponsorMarqueeShell>
  );
}

/** Home page sponsor strip: logos for the active division (or all), placeholders only when the tournament has no sponsors. */
export async function SponsorMarquee({
  tournamentId,
  divisionTabId,
  poolsForTabs,
}: {
  tournamentId: string;
  divisionTabId: string;
  poolsForTabs: PoolForDivisionTabs[];
}) {
  const sponsors = await listSponsorsForMarquee(tournamentId, {
    divisionTabId,
    poolsForTabs,
  });
  if (sponsors.length === 0) {
    const total = await countSponsorsForTournament(tournamentId);
    if (total === 0) return <SponsorMarqueePlaceholders />;
    return null;
  }
  return <SponsorMarqueeImages sponsors={sponsors} />;
}
