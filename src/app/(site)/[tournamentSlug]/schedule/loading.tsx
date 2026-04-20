import { PageTitle } from "@/components/ui/PublicHeading";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { SkeletonGameCardRow } from "@/components/ui/SkeletonGameCard";

export default function ScheduleLoading() {
  return (
    <PullToRefresh>
      <div className="flex flex-col gap-4">
        <PageTitle>Schedule</PageTitle>
        <div
          className="h-24 rounded-xl bg-zinc-100 motion-safe:animate-pulse motion-reduce:animate-none"
          aria-hidden
        />
        <ul className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="min-w-0">
              <SkeletonGameCardRow />
            </li>
          ))}
        </ul>
      </div>
    </PullToRefresh>
  );
}
