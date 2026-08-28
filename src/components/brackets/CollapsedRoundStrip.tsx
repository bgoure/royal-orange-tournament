"use client";

export function CollapsedRoundStrip({
  label,
  onExpand,
}: {
  label: string;
  onExpand: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onExpand}
      className="flex w-11 shrink-0 flex-col items-center justify-start gap-2 self-stretch rounded-xl border border-zinc-200 bg-zinc-50 px-1 py-3 text-royal shadow-sm"
      aria-label={`Show ${label}`}
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] [writing-mode:vertical-rl]">
        {label}
      </span>
      <span className="text-[9px] font-semibold text-zinc-500">Show</span>
    </button>
  );
}
