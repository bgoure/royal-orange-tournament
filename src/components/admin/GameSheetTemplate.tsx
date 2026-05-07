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
        className="h-24 max-h-24 w-auto max-w-[9.5rem] shrink-0 object-contain object-center print:h-16 print:max-h-16 print:max-w-[6rem]"
      />
    );
  }
  return (
    <div
      className="flex h-24 w-[7.25rem] shrink-0 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-[8px] font-medium uppercase tracking-wide text-slate-500 print:h-16 print:w-[6rem] print:text-[7px]"
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
        className="inline-block h-12 w-12 shrink-0 rounded border border-dashed border-slate-300 bg-white print:h-10 print:w-10"
        aria-hidden
      />
    );
  }
  return (
    <img
      src={url}
      alt=""
      className="h-12 w-12 shrink-0 rounded-sm border border-slate-200 bg-white object-contain p-0.5 print:h-10 print:w-10"
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
  sheetHeaderRightLogoUrl,
  division,
  date,
  time,
  location,
}: GameSheetTemplateProps) {
  const num = gameNumber.replace(/^\s*#?\s*/, "");
  const gameLabel = num ? `#${num}` : "#—";

  return (
    <article className="print-sheet-column box-border flex min-w-0 max-w-full flex-col gap-3 border border-slate-300 bg-white text-slate-800 shadow-sm print:gap-3 print:border print:border-slate-400 print:px-1.5 print:shadow-none">
      <header className="border-b border-amber-900/20 bg-white px-2 py-2 print:px-3 print:py-2">
        <div className="flex items-start justify-between gap-2 print:gap-1.5">
          <div className="h-24 w-[7.25rem] shrink-0 print:h-16 print:w-[6rem]" aria-hidden />
          <div className="min-w-0 max-w-full flex-1 px-1 text-center print:px-1.5">
            <p className="text-xs font-semibold leading-snug text-royal sm:text-sm print:text-xs">
              {associationName}
            </p>
            <div className="mt-1.5 max-w-full leading-tight break-words print:mt-1">{eventTitle}</div>
            <p className="mt-1.5 text-sm font-bold uppercase leading-snug tracking-wide text-royal sm:text-base print:mt-1 print:text-sm">
              {division} — Game results
            </p>
          </div>
          <HeaderLogoSlot url={sheetHeaderRightLogoUrl} label="Logo" />
        </div>
      </header>

      <div className="border border-royal/20 bg-royal-50/90 px-2 py-2 print:px-3 print:py-2">
        <div className="flex flex-col items-center gap-1 print:gap-0.5">
          <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-lg font-extrabold uppercase leading-snug tracking-wide text-royal print:text-[17px] sm:text-xl md:text-2xl">
            <div className="flex min-w-0 max-w-full items-center justify-center gap-2 print:gap-1.5">
              <TeamLogoMark url={homeTeamLogoUrl} />
              <span className="min-w-0 break-words">{homeTeam.toUpperCase()}</span>
            </div>
            <span className="shrink-0 text-xs font-semibold normal-case text-sky-600 print:text-[13px] sm:text-sm">
              vs
            </span>
          </div>
          <div className="flex w-full min-w-0 items-center justify-center gap-2 print:gap-1.5 text-lg font-extrabold uppercase leading-snug tracking-wide text-royal print:text-[17px] sm:text-xl md:text-2xl">
            <TeamLogoMark url={awayTeamLogoUrl} />
            <span className="min-w-0 break-words">{awayTeam.toUpperCase()}</span>
          </div>
        </div>
        <div className="mt-2 flex w-full min-w-0 justify-start print:mt-1.5">
          <div className="flex h-[4.25rem] w-9 shrink-0 items-center justify-center print:h-16 print:w-10">
            <span className="-rotate-90 select-none whitespace-nowrap text-base font-semibold text-royal print:text-lg sm:text-lg">
              Game {gameLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="border border-royal/15 bg-amber-50/95 px-2 py-2 print:px-3 print:py-2">
        <div className="flex flex-col gap-2 print:gap-1.5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-royal print:text-[10px] sm:text-xs">
              Pitch count game ID
            </p>
            <div className="mt-1 min-h-9 rounded-md border border-slate-300 bg-white print:min-h-8 sm:min-h-10" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-royal print:text-[10px] sm:text-xs">
              Convenor name
            </p>
            <div className="mt-1 min-h-9 rounded-md border border-slate-300 bg-white print:min-h-8 sm:min-h-10" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 border border-royal/25 bg-amber-50/90 px-2 py-2 text-[11px] text-slate-800 print:px-3 print:py-1.5 print:text-[9px] sm:text-xs">
        <span className="min-w-0">
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

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-1 print:gap-3 print:px-2.5 print:pb-2">
        <TeamBlock variant="home" />
        <TeamBlock variant="away" />
      </div>

      <footer className="print-sheet-footer-note mt-auto border-t border-slate-200 px-2 pb-2 pt-1 print:border-t-0 print:px-3 print:pb-2 print:pt-1">
        <p className="text-[9px] font-medium leading-snug text-red-700 print:text-[8px] sm:text-[10px]">
          Completed and signed game results sheets must be hand delivered to the game convenor or the concession
          stand at Lions Park 1 by the <strong className="font-bold">home team</strong> immediately following the
          conclusion of the game.
        </p>
        <div className="print-sheet-footer-brand mt-1 flex justify-center border-t border-dashed border-slate-200 pt-1.5 print:mt-1 print:border-t-0 print:pt-0 sm:pt-1.5">
          <p className="text-center text-[10px] font-bold tracking-tight print:text-[9px] sm:text-xs">
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
  const statLabelClass = isHome
    ? "mb-1 text-[10px] font-bold uppercase leading-tight text-accent-800 print:text-[9px] sm:text-xs"
    : "mb-1 text-[10px] font-bold uppercase leading-tight text-royal print:text-[9px] sm:text-xs";
  const titleInBoxClass = isHome
    ? "text-xs font-bold uppercase tracking-wide text-accent-800 print:text-[11px] sm:text-sm"
    : "text-xs font-bold uppercase tracking-wide text-royal-900 print:text-[11px] sm:text-sm";

  const shell =
    "overflow-hidden rounded-md border-2 print:rounded-sm print:border " +
    (isHome ? "border-accent-700/50 bg-accent-50/90" : "border-royal-700/50 bg-royal-50/90");

  return (
    <section className={shell}>
      <div className="p-0.5 print:p-1">
        <div className="flex flex-col bg-white">
          <div className="border-b border-slate-200 px-2 py-2 print:px-2.5 print:py-1.5">
            <p className={titleInBoxClass}>{headerLabel}:</p>
            <div className="mt-1 min-h-11 print:min-h-9 sm:min-h-12" />
          </div>
          <div className="grid grid-cols-[1fr_1fr_1.35fr] divide-x divide-slate-200 border-slate-200 sm:grid-cols-[1fr_1fr_1.45fr]">
            <div className="min-w-0 px-2 py-2 print:px-2 print:py-1.5">
              <p className={statLabelClass}>Runs scored</p>
              <div className="min-h-14 bg-white print:min-h-11 sm:min-h-16" />
            </div>
            <div className="min-w-0 px-2 py-2 print:px-2 print:py-1.5">
              <p className={statLabelClass}>Defensive innings</p>
              <div className="min-h-14 bg-white print:min-h-11 sm:min-h-16" />
            </div>
            <div className="min-w-0 px-2 py-2 print:px-2 print:py-1.5">
              <p className={statLabelClass}>{coachSigLabel}</p>
              <div className="min-h-14 bg-white print:min-h-11 sm:min-h-16" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
