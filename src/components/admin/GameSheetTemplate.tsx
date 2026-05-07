import type { ReactNode } from "react";

export type GameSheetTemplateProps = {
  associationName: string;
  eventTitle: ReactNode;
  gameNumber: string;
  homeTeam: string;
  awayTeam: string;
  division: string;
  date: string;
  time: string;
  location: string;
};

/** Single landscape half-page game results sheet for handwritten scores and signatures. */
export function GameSheetTemplate({
  associationName,
  eventTitle,
  gameNumber,
  homeTeam,
  awayTeam,
  division,
  date,
  time,
  location,
}: GameSheetTemplateProps) {
  const num = gameNumber.replace(/^\s*#?\s*/, "");
  const gameLabel = num ? `#${num}` : "#—";

  return (
    <article className="flex h-full min-h-0 flex-col border border-slate-300 bg-white text-slate-800 shadow-sm print:border-slate-400 print:shadow-none">
      <header className="border-b border-amber-900/25 bg-white px-2 py-2">
        <div className="flex items-start justify-between gap-2">
          <div
            className="flex h-11 w-[4.25rem] shrink-0 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-[8px] font-medium uppercase tracking-wide text-slate-500"
            aria-hidden
          >
            Logo
          </div>
          <div className="min-w-0 flex-1 px-1 text-center">
            <p className="text-[10px] font-semibold leading-tight text-zinc-900 sm:text-xs">
              {associationName}
            </p>
            <p className="mt-0.5 text-xs font-semibold leading-tight sm:text-sm">{eventTitle}</p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-zinc-900 sm:text-sm">
              {division} — Game results
            </p>
          </div>
          <div
            className="flex h-11 w-[4.25rem] shrink-0 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-[8px] font-medium uppercase tracking-wide text-slate-500"
            aria-hidden
          >
            Logo
          </div>
        </div>
      </header>

      <div className="border-y-2 border-amber-800/60 bg-royal px-2 py-1.5 text-white">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs font-bold uppercase tracking-wide sm:text-sm">
          <span>Game {gameLabel}</span>
          <span className="min-w-0 text-right font-extrabold leading-tight">
            {homeTeam.toUpperCase()}{" "}
            <span className="mx-1 text-[10px] font-semibold normal-case opacity-95">vs</span>{" "}
            {awayTeam.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="border-b border-amber-900/20 bg-amber-50/90">
        <div className="grid gap-0 border-b border-amber-900/15 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-800 sm:text-[11px]">
          <div className="flex min-h-8 items-center border-b border-amber-900/10 pb-1">
            <span className="w-36 shrink-0 sm:w-44">Pitch count game ID</span>
            <span className="min-h-5 flex-1 border-b border-slate-400/70" />
          </div>
          <div className="flex min-h-8 items-center pt-1">
            <span className="w-36 shrink-0 sm:w-44">Convenor name</span>
            <span className="min-h-5 flex-1 border-b border-slate-400/70" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-0.5 border-b border-amber-900/25 bg-amber-50/80 px-2 py-1 text-[10px] text-slate-800 sm:text-[11px]">
        <span>
          <span className="font-bold">Date:</span> {date}
        </span>
        <span className="min-w-0 flex-1 sm:text-right">
          <span className="font-bold">Time:</span> {time}
          {location ? (
            <>
              {" "}
              <span className="text-slate-600">— {location}</span>
            </>
          ) : null}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
        <TeamBlock variant="home" />
        <TeamBlock variant="away" />
      </div>

      <footer className="mt-auto border-t border-slate-200 px-2 pb-2 pt-1">
        <p className="text-[9px] font-medium leading-snug text-red-700 sm:text-[10px]">
          Completed and signed game results sheets must be hand delivered to the tournament pavilion (located
          between the outfield fences of Lions #1 and Lions #2 diamonds), by the{" "}
          <strong className="font-bold">home team</strong>, immediately following the conclusion of the game.
        </p>
        <div className="mt-2 flex justify-center border-t border-dashed border-slate-200 pt-2">
          <p className="text-center text-[10px] font-bold tracking-tight">
            <span className="text-accent">Baseball</span>{" "}
            <span className="text-royal">Milton</span>
          </p>
        </div>
      </footer>
    </article>
  );
}

function TeamBlock({ variant }: { variant: "home" | "away" }) {
  const isHome = variant === "home";
  const label = isHome ? "Home team" : "Away team";
  const headerBg = isHome ? "bg-accent-100" : "bg-royal-100";
  const headerText = isHome ? "text-accent-800" : "text-royal-900";
  const ring = isHome ? "border-accent-800/35" : "border-royal-800/35";

  return (
    <section className={`flex flex-col overflow-hidden rounded-md border ${ring}`}>
      <div className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${headerBg} ${headerText}`}>
        {label}:
      </div>
      <div className="grid grid-cols-2 gap-0 border-t border-slate-200 bg-white">
        <div className="border-r border-slate-200 p-1.5">
          <p className="text-[9px] font-bold uppercase text-slate-700">Score (runs scored)</p>
          <div className="mt-1 min-h-16 rounded-sm border border-slate-300 bg-white print:min-h-20" />
        </div>
        <div className="p-1.5">
          <p className="text-[9px] font-bold uppercase text-slate-700">Defensive innings</p>
          <div className="mt-1 min-h-16 rounded-sm border border-slate-300 bg-white print:min-h-20" />
        </div>
      </div>
      <div className="border-t border-slate-200 p-1.5">
        <p className="text-[9px] font-bold uppercase text-slate-700">
          {label} coach signature
        </p>
        <div className="mt-1 min-h-[4.5rem] rounded-sm border border-slate-300 bg-white print:min-h-24" />
      </div>
    </section>
  );
}
