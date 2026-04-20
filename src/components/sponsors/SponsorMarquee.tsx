import type { ReactNode } from "react";
import { listSponsorsForMarquee } from "@/lib/services/sponsors";
import { sponsorLogoUrl } from "@/lib/sponsor-logo";

const PLACEHOLDER_IDS = [0, 1, 2, 3, 4] as const;

/** Inline “classic” baseball: cream sphere + mirrored red seam curves + stitch ticks. */
function BaseballMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="32" cy="32" r="28" className="fill-[#f5f4f0] stroke-zinc-400/90" strokeWidth="1.5" />
      <ellipse cx="26" cy="24" rx="14" ry="11" fill="#ffffff" opacity={0.45} />
      {/* Horseshoe seams (mirrored) */}
      <path
        d="M 38 9 C 52 20 52 44 38 55"
        className="stroke-red-700"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 26 9 C 12 20 12 44 26 55"
        className="stroke-red-700"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      {/* Stitch ticks along seams */}
      <g className="stroke-red-700" strokeWidth="1.8" strokeLinecap="round">
        <path d="M 41 16 l 3 -2" />
        <path d="M 44 24 l 3.5 -1" />
        <path d="M 44 32 h 4" />
        <path d="M 44 40 l 3.5 1" />
        <path d="M 41 48 l 3 2" />
        <path d="M 23 16 l -3 -2" />
        <path d="M 20 24 l -3.5 -1" />
        <path d="M 20 32 h -4" />
        <path d="M 20 40 l -3.5 1" />
        <path d="M 23 48 l -3 2" />
      </g>
    </svg>
  );
}

function PlaceholderSlot() {
  return (
    <div
      className="flex h-16 w-28 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 shadow-sm"
      aria-hidden
    >
      <BaseballMark className="size-11 text-zinc-700" />
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
