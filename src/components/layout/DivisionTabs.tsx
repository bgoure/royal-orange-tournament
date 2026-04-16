"use client";

type TabOption = { id: string; name: string };

function tabColorLight(name: string, active: boolean): string {
  const lower = name.toLowerCase();
  if (lower.includes("10u") || lower === "all") {
    return active
      ? "bg-accent text-white shadow-sm"
      : "bg-accent-50 text-accent-700 hover:bg-accent-100";
  }
  if (lower.includes("11u")) {
    return active
      ? "bg-royal text-white shadow-sm"
      : "bg-royal-50 text-royal-700 hover:bg-royal-100";
  }
  return active
    ? "bg-royal text-white shadow-sm"
    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200";
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
      : "flex flex-wrap gap-2 border-b border-zinc-200 pb-3";

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
          className={`min-h-11 rounded-full px-4 py-2.5 text-sm font-medium transition-colors active:opacity-90 ${tabColor(t.name, i === activeIndex)}`}
        >
          {t.name}
        </button>
      ))}
    </div>
  );
}
