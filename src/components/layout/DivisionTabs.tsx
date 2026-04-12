"use client";

type TabOption = { id: string; name: string };

function tabColor(name: string, active: boolean): string {
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

export function DivisionTabs({
  tabs,
  activeIndex,
  onSelect,
  disabled,
}: {
  tabs: TabOption[];
  activeIndex: number;
  onSelect: (index: number) => void;
  disabled?: boolean;
}) {
  if (tabs.length <= 1) return null;

  return (
    <div
      className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3"
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
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${tabColor(t.name, i === activeIndex)}`}
        >
          {t.name}
        </button>
      ))}
    </div>
  );
}
