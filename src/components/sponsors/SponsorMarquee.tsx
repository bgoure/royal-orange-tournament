const PLACEHOLDER_IDS = [0, 1, 2, 3, 4] as const;

function BaseballMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="24" cy="24" r="20" className="fill-white stroke-zinc-300" strokeWidth="1.5" />
      <path
        d="M14 18c2.5 2 6.5 3.5 10 3.5s7.5-1.5 10-3.5M14 30c2.5-2 6.5-3.5 10-3.5s7.5 1.5 10 3.5"
        className="stroke-red-600"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        d="M18 14c1.5 3 2.5 7 2.5 10s-1 7-2.5 10M30 14c-1.5 3-2.5 7-2.5 10s1 7 2.5 10"
        className="stroke-red-600"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SponsorSlot() {
  return (
    <div
      className="flex h-16 w-28 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 shadow-sm"
      aria-hidden
    >
      <BaseballMark className="size-11 text-zinc-700" />
    </div>
  );
}

/**
 * Infinite horizontal marquee for sponsor logos (placeholder slots until real assets exist).
 */
export function SponsorMarquee() {
  const loop = [...PLACEHOLDER_IDS, ...PLACEHOLDER_IDS];

  return (
    <section
      className="border-t border-zinc-200/90 pt-5"
      aria-labelledby="sponsor-marquee-heading"
    >
      <h2 id="sponsor-marquee-heading" className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">
        Sponsors
      </h2>
      <div className="-mx-4 overflow-hidden px-4 md:mx-0 md:px-0">
        <div className="sponsor-marquee-track flex w-max gap-6 md:gap-10">
          {loop.map((id, i) => (
            <SponsorSlot key={`${id}-${i}`} />
          ))}
        </div>
      </div>
    </section>
  );
}
