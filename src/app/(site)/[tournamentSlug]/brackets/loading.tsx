import { publicGlassCardXl } from "@/lib/public-glass-card";

export default function BracketsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div
        className={`min-h-[16rem] w-full motion-safe:animate-pulse motion-reduce:animate-none ${publicGlassCardXl}`}
        aria-hidden
      />
    </div>
  );
}
