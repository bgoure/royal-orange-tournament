import { PageTitle } from "@/components/ui/PublicHeading";
import { SectionTitle } from "@/components/ui/PublicHeading";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { SkeletonGameCardRow } from "@/components/ui/SkeletonGameCard";

export default function ResultsLoading() {
  return (
    <PullToRefresh>
      <div className="flex flex-col gap-4">
        <PageTitle>Results</PageTitle>
        <div
          className="min-h-[14rem] w-full rounded-xl border border-zinc-200 bg-zinc-50 motion-safe:animate-pulse motion-reduce:animate-none"
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
