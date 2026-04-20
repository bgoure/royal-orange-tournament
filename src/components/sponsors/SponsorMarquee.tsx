import type { ReactNode } from "react";
import { listSponsorsForMarquee } from "@/lib/services/sponsors";
import { sponsorLogoUrl } from "@/lib/sponsor-logo";

const PLACEHOLDER_IDS = [0, 1, 2, 3, 4] as const;

function PlaceholderSlot() {
  return (
    <div
      className="flex h-16 w-28 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 shadow-sm"
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
      className="border-t border-zinc-200/90 pt-5"
      aria-labelledby="sponsor-marquee-heading"
    >
      <h2
        id="sponsor-marquee-heading"
        className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500"
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
        <PlaceholderSlot key={`${id}-${i}`} />
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
          className="flex h-16 w-28 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white px-2 shadow-sm"
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

/** Home page sponsor strip: real logos from admin, or placeholder baseball marks until the first upload. */
export async function SponsorMarquee({ tournamentId }: { tournamentId: string }) {
  const sponsors = await listSponsorsForMarquee(tournamentId);
  if (sponsors.length === 0) {
    return <SponsorMarqueePlaceholders />;
  }
  return <SponsorMarqueeImages sponsors={sponsors} />;
}
