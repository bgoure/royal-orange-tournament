/** Loading placeholder matching compact horizontal `GameCardInner` layout (parent sets width). */
export function SkeletonGameCard({ className = "" }: { className?: string }) {
  const pulse = "motion-safe:animate-pulse motion-reduce:animate-none";
  return (
    <div
      className={`min-h-[48px] w-full shrink-0 rounded-2xl border border-zinc-200 bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.1)] ${className}`.trim()}
      aria-hidden
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`h-4 w-24 rounded-md bg-zinc-200 ${pulse}`} />
        <span className={`h-6 w-14 shrink-0 rounded-full bg-zinc-200 ${pulse}`} />
      </div>
      <div className="mt-2 space-y-2">
        <div className="flex items-center gap-2">
          <span className={`size-7 shrink-0 rounded-full bg-zinc-200 ${pulse}`} />
          <span className={`h-3 min-w-0 flex-1 rounded-md bg-zinc-200 ${pulse}`} />
        </div>
        <div className="flex items-center gap-2">
          <span className={`size-7 shrink-0 rounded-full bg-zinc-200 ${pulse}`} />
          <span className={`h-3 w-[80%] max-w-[8rem] rounded-md bg-zinc-200 ${pulse}`} />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={`h-5 w-8 rounded-md bg-zinc-200 ${pulse}`} />
        <span className={`h-3 w-20 rounded bg-zinc-200 ${pulse}`} />
      </div>
    </div>
  );
}

/** Vertical list variant (full-width schedule / results row). */
export function SkeletonGameCardRow({ className = "" }: { className?: string }) {
  const pulse = "motion-safe:animate-pulse motion-reduce:animate-none";
  return (
    <div
      className={`rounded-2xl border border-zinc-200 border-l-2 border-l-royal/90 bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.1)] ${className}`.trim()}
      aria-hidden
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`h-4 w-40 max-w-[55%] rounded-md bg-zinc-200 ${pulse}`} />
        <span className={`h-6 w-16 shrink-0 rounded-full bg-zinc-200 ${pulse}`} />
      </div>
      <div className="mt-2 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className={`size-8 shrink-0 rounded-full bg-zinc-200 ${pulse}`} />
            <span className={`h-4 min-w-0 flex-1 rounded-md bg-zinc-200 ${pulse}`} />
          </div>
          <span className={`h-5 w-6 rounded bg-zinc-200 ${pulse}`} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className={`size-8 shrink-0 rounded-full bg-zinc-200 ${pulse}`} />
            <span className={`h-4 min-w-0 flex-1 rounded-md bg-zinc-200 ${pulse}`} />
          </div>
          <span className={`h-5 w-6 rounded bg-zinc-200 ${pulse}`} />
        </div>
      </div>
      <div className="mt-2">
        <span className={`inline-block h-3 w-48 max-w-full rounded bg-zinc-200 ${pulse}`} />
      </div>
    </div>
  );
}
