import type { FormatExplainerSection } from "@/lib/brackets/oba-de-presets";

export function BracketFormatExplainer({ sections }: { sections: FormatExplainerSection[] }) {
  if (sections.length === 0) return null;
  return (
    <div className="mt-3 space-y-3 rounded-lg border border-emerald-200/80 bg-emerald-50/60 px-3 py-3 text-sm text-zinc-800">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
        How this format works
      </p>
      {sections.map((s) => (
        <div key={s.title}>
          <p className="font-medium text-zinc-900">{s.title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-600">{s.body}</p>
        </div>
      ))}
    </div>
  );
}
