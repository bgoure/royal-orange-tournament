import { DIVISION_SWIPE_IGNORE } from "@/lib/division-swipe-ignore";
import { SectionTitle } from "@/components/ui/PublicHeading";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { SkeletonAnnouncement } from "@/components/ui/SkeletonAnnouncement";
import { SkeletonGameCard } from "@/components/ui/SkeletonGameCard";

const horizontalRowItemClass =
  "flex-none shrink-0 snap-start w-[min(200px,calc(100vw-2rem))] max-[374px]:w-[min(180px,calc(100vw-2.5rem))]";

function QuickLinkSkeleton() {
  return (
    <div
      className="flex min-h-[48px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-zinc-200 border-l-2 border-l-royal/90 bg-white p-4 text-center shadow-sm motion-safe:animate-pulse motion-reduce:animate-none"
      aria-hidden
    >
      <span className="size-7 rounded-full bg-zinc-200" />
      <span className="h-3 w-16 rounded bg-zinc-200" />
      <span className="h-2.5 w-24 rounded bg-zinc-100" />
    </div>
  );
}

export default function TournamentHomeLoading() {
  return (
    <PullToRefresh>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <div
              className="h-4 w-48 max-w-full rounded bg-zinc-200 motion-safe:animate-pulse motion-reduce:animate-none"
              aria-hidden
            />
            <div
              className="h-24 rounded-xl bg-zinc-100 motion-safe:animate-pulse motion-reduce:animate-none"
              aria-hidden
            />
            <section>
              <SectionTitle className="mb-3">Upcoming games</SectionTitle>
              <ul
                {...{ [DIVISION_SWIPE_IGNORE]: "" }}
                className="-mx-4 flex flex-nowrap snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-2 [scrollbar-width:thin]"
              >
                {[0, 1, 2, 3].map((i) => (
                  <li key={i} className={horizontalRowItemClass}>
                    <SkeletonGameCard />
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <QuickLinkSkeleton key={i} />
            ))}
          </div>
        </div>

        <section>
          <SectionTitle className="mb-3">Announcements</SectionTitle>
          <ul className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <SkeletonAnnouncement key={i} />
            ))}
          </ul>
        </section>
      </div>
    </PullToRefresh>
  );
}
