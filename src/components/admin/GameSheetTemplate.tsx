import type { ReactNode } from "react";

/* eslint-disable @next/next/no-img-element -- Printable sheet uses API/static URLs; next/image complicates print. */

export type GameSheetTemplateProps = {
  associationName: string;
  eventTitle: ReactNode;
  gameNumber: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogoUrl?: string | null;
  awayTeamLogoUrl?: string | null;
  sheetHeaderLeftLogoUrl?: string | null;
  sheetHeaderRightLogoUrl?: string | null;
  division: string;
  date: string;
  time: string;
  location: string;
};

function HeaderLogoSlot({ url, label }: { url?: string | null; label: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="h-9 max-h-9 w-auto max-w-[4.5rem] shrink-0 object-contain object-center print:h-7 print:max-h-7 print:max-w-[3.75rem]"
      />
    );
  }
  return (
    <div
      className="flex h-9 w-14 shrink-0 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-[7px] font-medium uppercase tracking-wide text-slate-500 print:h-7 print:w-12 print:text-[6px]"
      aria-hidden
    >
      {label}
    </div>
  );
}

function TeamLogoMark({ url }: { url?: string | null }) {
  if (!url) {
    return (
      <span
        className="inline-block h-7 w-7 shrink-0 rounded border border-dashed border-slate-300 bg-white print:h-6 print:w-6"
        aria-hidden
      />
    );
  }
  return (
    <img
      src={url}
      alt=""
      className="h-7 w-7 shrink-0 rounded-sm border border-slate-200 bg-white object-contain p-0.5 print:h-6 print:w-6"
    />
  );
}

/** Single landscape half-page game results sheet for handwritten scores and signatures. */
export function GameSheetTemplate({
  associationName,
  eventTitle,
  gameNumber,
  homeTeam,
  awayTeam,
  homeTeamLogoUrl,
  awayTeamLogoUrl,
  sheetHeaderLeftLogoUrl,
  sheetHeaderRightLogoUrl,
  division,
  date,
  time,
  location,
}: GameSheetTemplateProps) {
  const num = gameNumber.replace(/^\s*#?\s*/, "");
  const gameLabel = num ? `#${num}` : "#—";

  return (
    <article className="flex h-full min-h-0 flex-col border border-slate-300 bg-white text-slate-800 shadow-sm print:border-slate-400 print:shadow-none">
      <header className="border-b border-amber-900/20 bg-white px-1.5 py-1 print:px-1 print:py-0.5">
        <div className="flex items-start justify-between gap-1.5 print:gap-1">
          <HeaderLogoSlot url={sheetHeaderLeftLogoUrl} label="Logo" />
          <div className="min-w-0 flex-1 px-0.5 text-center">
            <p className="text-[9px] font-semibold leading-snug text-royal sm:text-[10px] print:text-[8px]">
              {associationName}
            </p>
            <div className="mt-0.5 leading-tight print:mt-px">{eventTitle}</div>
            <p className="mt-0.5 text-[10px] font-bold uppercase leading-snug tracking-wide text-royal sm:text-[11px] print:mt-px print:text-[9px]">
              {division} — Game results
            </p>
          </div>
          <HeaderLogoSlot url={sheetHeaderRightLogoUrl} label="Logo" />
        </div>
      </header>

      <div className="border-b border-royal/20 bg-royal-50/90 px-1.5 py-1 print:px-1 print:py-0.5">
        <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-[11px] font-extrabold uppercase leading-snug tracking-wide text-royal print:gap-x-1 print:text-[10px] sm:text-xs">
          <div className="flex min-w-0 items-center gap-1 print:gap-0.5">
            <TeamLogoMark url={homeTeamLogoUrl} />
            <span className="min-w-0">{homeTeam.toUpperCase()}</span>
          </div>
          <span className="text-[10px] font-semibold normal-case text-sky-600 print:text-[9px]">vs</span>
          <div className="flex min-w-0 items-center gap-1 print:gap-0.5">
            <TeamLogoMark url={awayTeamLogoUrl} />
            <span className="min-w-0">{awayTeam.toUpperCase()}</span>
          </div>
        </div>
        <p className="mt-0.5 text-center text-[9px] font-semibold text-royal print:mt-px print:text-[8px]">
          Game {gameLabel}
        </p>
      </div>

      <div className="border-b border-royal/15 bg-amber-50/95 px-1.5 py-1 print:px-1 print:py-0.5">
        <div className="flex flex-col gap-1 print:gap-0.5">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wide text-royal print:text-[8px] sm:text-[10px]">
              Pitch count game ID
            </p>
            <div className="mt-0.5 min-h-8 rounded-md border border-slate-300 bg-white print:min-h-6 sm:min-h-9" />
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wide text-royal print:text-[8px] sm:text-[10px]">
              Convenor name
            </p>
            <div className="mt-0.5 min-h-8 rounded-md border border-slate-300 bg-white print:min-h-6 sm:min-h-9" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0 border-b border-royal/25 bg-amber-50/90 px-1.5 py-1 text-[9px] text-slate-800 print:px-1 print:py-0.5 print:text-[8px] sm:text-[10px]">
        <span>
          <span className="font-bold text-royal">Date:</span> {date}
        </span>
        <span className="min-w-0 text-right">
          <span className="font-bold text-royal">Time:</span> {time}
          {location ? (
            <>
              {" "}
              <span className="text-slate-700">— {location}</span>
            </>
          ) : null}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1 p-1 print:gap-0.5 print:p-0.5">
        <TeamBlock variant="home" />
        <TeamBlock variant="away" />
      </div>

      <footer className="mt-auto border-t border-slate-200 px-1.5 pb-1 pt-0.5 print:px-1 print:pb-0.5 print:pt-px">
        <p className="text-[8px] font-medium leading-snug text-red-700 print:text-[7px] sm:text-[9px]">
          Completed and signed game results sheets must be hand delivered to the game convenor or the concession
          stand at Lions Park 1 by the <strong className="font-bold">home team</strong> immediately following the
          conclusion of the game.
        </p>
        <div className="mt-1 flex justify-center border-t border-dashed border-slate-200 pt-1 print:mt-0.5 print:pt-0.5">
          <p className="text-center text-[9px] font-bold tracking-tight print:text-[8px]">
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
  const headerLabel = isHome ? "Home team" : "Away team";
  const coachSigLabel = isHome ? "Home team coach signature" : "Away team coach signature";

  const shell =
    "rounded-md border-2 print:rounded-sm " +
    (isHome ? "border-accent-700/50 bg-accent-50/90" : "border-royal-700/50 bg-royal-50/90");
  const headerRow = isHome ? "bg-accent-100/90 text-accent-800" : "bg-royal-100/95 text-royal-900";

  return (
    <section className={`flex flex-col overflow-hidden ${shell}`}>
      <div
        className={`px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide print:px-1 print:py-0.5 print:text-[9px] sm:text-[11px] ${headerRow}`}
      >
        {headerLabel}:
      </div>
      <div className="border-t border-white/60 bg-white/90 px-1.5 py-1 print:px-1 print:py-0.5">
        <div className="relative min-h-9 rounded-md border border-slate-300 bg-white px-2 py-1 print:min-h-7 sm:min-h-10">
          <span className="pointer-events-none select-none text-[9px] text-zinc-400 print:text-[8px] sm:text-[10px]">
            Write team name here
          </span>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_1fr_1.35fr] gap-0.5 border-t border-white/60 bg-white/90 p-1 print:gap-px print:p-0.5 sm:grid-cols-[1fr_1fr_1.45fr]">
        <div className="min-w-0 rounded-md border border-slate-300 bg-white p-1 print:p-0.5">
          <p className="text-[8px] font-bold uppercase leading-tight text-royal print:text-[7px] sm:text-[9px]">
            Runs scored
          </p>
          <div className="relative mt-0.5 min-h-12 rounded border border-slate-200 bg-white print:min-h-9 sm:min-h-14">
            <span className="pointer-events-none absolute left-1 top-0.5 text-sm text-zinc-300 print:text-xs">#</span>
          </div>
        </div>
        <div className="min-w-0 rounded-md border border-slate-300 bg-white p-1 print:p-0.5">
          <p className="text-[8px] font-bold uppercase leading-tight text-royal print:text-[7px] sm:text-[9px]">
            Defensive innings
          </p>
          <div className="relative mt-0.5 min-h-12 rounded border border-slate-200 bg-white print:min-h-9 sm:min-h-14">
            <span className="pointer-events-none absolute left-1 top-0.5 text-sm text-zinc-300 print:text-xs">#</span>
          </div>
        </div>
        <div className="min-w-0 rounded-md border border-slate-300 bg-white p-1 print:p-0.5">
          <p className="text-[8px] font-bold uppercase leading-tight text-royal print:text-[7px] sm:text-[9px]">
            {coachSigLabel}
          </p>
          <div className="relative mt-0.5 flex min-h-12 flex-col justify-end rounded border border-slate-200 bg-white print:min-h-9 sm:min-h-14">
            <div className="mx-1 mb-1 border-b border-sky-200/90 print:mb-0.5" />
          </div>
        </div>
      </div>
    </section>
  );
}
