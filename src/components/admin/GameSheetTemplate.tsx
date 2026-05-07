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
        className="h-11 max-h-11 w-auto max-w-[5rem] shrink-0 object-contain object-center"
      />
    );
  }
  return (
    <div
      className="flex h-11 w-[4.25rem] shrink-0 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-[8px] font-medium uppercase tracking-wide text-slate-500"
      aria-hidden
    >
      {label}
    </div>
  );
}

function TeamLogoMark({ url }: { url?: string | null }) {
  if (!url) {
    return <span className="inline-block h-9 w-9 shrink-0 rounded border border-dashed border-slate-300 bg-white" aria-hidden />;
  }
  return (
    <img
      src={url}
      alt=""
      className="h-9 w-9 shrink-0 rounded-sm border border-slate-200 bg-white object-contain p-0.5"
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
      <header className="border-b border-amber-900/25 bg-white px-2 py-2">
        <div className="flex items-start justify-between gap-2">
          <HeaderLogoSlot url={sheetHeaderLeftLogoUrl} label="Logo" />
          <div className="min-w-0 flex-1 px-1 text-center">
            <p className="text-[10px] font-semibold leading-tight text-zinc-900 sm:text-xs">
              {associationName}
            </p>
            <p className="mt-0.5 text-xs font-semibold leading-tight sm:text-sm">{eventTitle}</p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-zinc-900 sm:text-sm">
              {division} — Game results
            </p>
          </div>
          <HeaderLogoSlot url={sheetHeaderRightLogoUrl} label="Logo" />
        </div>
      </header>

      <div className="border-y border-royal/25 bg-royal-50 px-2 py-2 text-royal">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm font-extrabold uppercase leading-tight tracking-wide sm:text-base">
          <div className="flex min-w-0 items-center gap-1.5">
            <TeamLogoMark url={homeTeamLogoUrl} />
            <span className="min-w-0 text-royal">{homeTeam.toUpperCase()}</span>
          </div>
          <span className="text-[11px] font-semibold normal-case text-royal-900/90">vs</span>
          <div className="flex min-w-0 items-center gap-1.5">
            <TeamLogoMark url={awayTeamLogoUrl} />
            <span className="min-w-0 text-royal">{awayTeam.toUpperCase()}</span>
          </div>
        </div>
        <p className="mt-1 text-center text-[10px] font-semibold text-royal-900/85 sm:text-[11px]">
          Game {gameLabel}
        </p>
      </div>

      <div className="border-b border-amber-900/15 bg-amber-50/90 px-2 py-2">
        <div className="flex flex-col gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-800 sm:text-xs">
              Pitch count game ID
            </p>
            <div className="mt-1 min-h-11 rounded-md border border-slate-300 bg-white print:min-h-12" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-800 sm:text-xs">
              Convenor name
            </p>
            <div className="mt-1 min-h-11 rounded-md border border-slate-300 bg-white print:min-h-12" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-0.5 border-b border-amber-900/25 bg-amber-50/80 px-2 py-1.5 text-[11px] text-slate-800 sm:text-xs">
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
        <p className="text-[10px] font-medium leading-snug text-red-700 sm:text-[11px]">
          Completed and signed game results sheets must be hand delivered to the game convenor or the concession
          stand at Lions Park 1 by the <strong className="font-bold">home team</strong> immediately following the
          conclusion of the game.
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
      <div
        className={`px-2 py-1.5 text-xs font-bold uppercase tracking-wide sm:text-sm ${headerBg} ${headerText}`}
      >
        {label}:
      </div>
      <div className="border-t border-slate-200 bg-white px-2 py-1.5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-700 sm:text-xs">
          Team name ({isHome ? "home" : "away"} — fill in after coin flip)
        </p>
        <div className="mt-1 min-h-12 rounded-md border border-slate-300 bg-white print:min-h-14" />
      </div>
      <div className="grid grid-cols-2 gap-0 border-t border-slate-200 bg-white">
        <div className="border-r border-slate-200 p-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-800 sm:text-xs">
            Score (runs scored)
          </p>
          <div className="mt-1.5 min-h-[4.5rem] rounded-md border border-slate-300 bg-white print:min-h-20" />
        </div>
        <div className="p-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-800 sm:text-xs">
            Defensive innings
          </p>
          <div className="mt-1.5 min-h-[4.5rem] rounded-md border border-slate-300 bg-white print:min-h-20" />
        </div>
      </div>
      <div className="border-t border-slate-200 p-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-800 sm:text-xs">
          {label} coach signature
        </p>
        <div className="mt-1.5 min-h-[5rem] rounded-md border border-slate-300 bg-white print:min-h-24" />
      </div>
    </section>
  );
}
