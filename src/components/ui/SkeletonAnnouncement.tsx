import { publicGlassCardXl } from "@/lib/public-glass-card";

export function SkeletonAnnouncement({ className = "" }: { className?: string }) {
  const pulse = "motion-safe:animate-pulse motion-reduce:animate-none";
  return (
    <li
      className={`px-4 py-3 ${publicGlassCardXl} ${className}`.trim()}
      aria-hidden
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className={`h-4 w-40 max-w-[70%] rounded-md bg-zinc-200 ${pulse}`} />
        <span className={`h-3 w-24 shrink-0 rounded bg-zinc-200 ${pulse}`} />
      </div>
      <div className="mt-3 space-y-2">
        <span className={`block h-3 w-full rounded bg-zinc-200 ${pulse}`} />
        <span className={`block h-3 w-[92%] rounded bg-zinc-200 ${pulse}`} />
        <span className={`block h-3 w-[60%] rounded bg-zinc-200 ${pulse}`} />
      </div>
    </li>
  );
}
