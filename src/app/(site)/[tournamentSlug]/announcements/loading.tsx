import { SkeletonAnnouncement } from "@/components/ui/SkeletonAnnouncement";

export default function AnnouncementsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div
          className="h-8 w-48 max-w-full rounded bg-zinc-200 motion-safe:animate-pulse motion-reduce:animate-none"
          aria-hidden
        />
        <div
          className="mt-2 h-4 w-full max-w-md rounded bg-zinc-100 motion-safe:animate-pulse motion-reduce:animate-none"
          aria-hidden
        />
      </div>
      <ul className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonAnnouncement key={i} />
        ))}
      </ul>
    </div>
  );
}
