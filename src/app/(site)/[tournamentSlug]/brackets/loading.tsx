export default function BracketsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div
        className="min-h-[16rem] w-full rounded-xl bg-zinc-100 motion-safe:animate-pulse motion-reduce:animate-none"
        aria-hidden
      />
    </div>
  );
}
