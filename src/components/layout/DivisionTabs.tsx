"use client";

type TabOption = { id: string; name: string };

/** Matches `DivisionSwitcher` pill styling for public royal/orange brand. */
function tabColorLight(_name: string, active: boolean): string {
  return active
    ? "border-2 border-royal bg-royal font-semibold text-white shadow-sm"
    : "border-2 border-zinc-200 bg-zinc-100 font-medium text-zinc-800 hover:border-zinc-300 hover:bg-zinc-200";
}

function tabColorDark(name: string, active: boolean): string {
  const lower = name.toLowerCase();
  if (lower.includes("10u") || lower === "all") {
    return active
      ? "bg-accent text-white shadow-sm ring-2 ring-white/30"
      : "border border-white/20 bg-white/10 text-accent-light hover:bg-white/15";
  }
  if (lower.includes("11u")) {
    return active
      ? "bg-white text-royal-900 shadow-sm ring-2 ring-white/40"
      : "border border-white/20 bg-white/10 text-white hover:bg-white/20";
  }
  return active
    ? "bg-white text-royal-900 shadow-sm"
    : "border border-white/20 bg-white/10 text-white/90 hover:bg-white/15";
}

export function DivisionTabs({
  tabs,
  activeIndex,
  onSelect,
  disabled,
  variant = "light",
  className,
}: {
  tabs: TabOption[];
  activeIndex: number;
  onSelect: (index: number) => void;
  disabled?: boolean;
  variant?: "light" | "dark";
  className?: string;
}) {
  if (tabs.length <= 1) return null;

  const tabColor = variant === "dark" ? tabColorDark : tabColorLight;
  const wrap =
    variant === "dark"
      ? "flex flex-wrap gap-2"
      : "flex flex-wrap gap-2 border-b border-royal/15 pb-3";

  return (
    <div
      className={[wrap, className].filter(Boolean).join(" ")}
      role="tablist"
      aria-label="Divisions"
    >
      {tabs.map((t, i) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={i === activeIndex}
          disabled={disabled}
          onClick={() => onSelect(i)}
          className={`min-h-[44px] rounded-lg px-[14px] py-2.5 text-sm font-medium transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal focus-visible:ring-offset-2 active:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 md:min-h-10 sm:text-base ${tabColor(t.name, i === activeIndex)}`}
        >
          {t.name}
        </button>
      ))}
    </div>
  );
}
