import { PageTitle } from "@/components/ui/PublicHeading";
import { SectionTitle } from "@/components/ui/PublicHeading";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { SkeletonGameCardRow } from "@/components/ui/SkeletonGameCard";
import { publicGlassCardXl } from "@/lib/public-glass-card";

export default function ResultsLoading() {
  return (
    <PullToRefresh>
      <div className="flex flex-col gap-4">
        <PageTitle>Results</PageTitle>
        <div
          className={`min-h-[14rem] w-full motion-safe:animate-pulse motion-reduce:animate-none ${publicGlassCardXl}`}
          aria-hidden
        />
        <section className="flex flex-col gap-3">
          <SectionTitle id="completed-games-heading">Completed games</SectionTitle>
          <ul className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <li key={i} className="min-w-0">
                <SkeletonGameCardRow />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PullToRefresh>
  );
}
