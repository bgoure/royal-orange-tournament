"use client";

import { brandCardGradientClass } from "@/lib/brand-card-gradient";
import { TeamLogoMark } from "@/components/ui/TeamLogo";
import type { TeamWithPublicLogo } from "@/lib/team-logo";
import { BRACKET_TEAM_NAME_CLASS } from "@/components/brackets/bracket-card-layout";

export type BracketByeCardProps = {
  seed: string;
  title: string;
  teamName: string;
  team: TeamWithPublicLogo | null;
  footnote?: string;
  muted?: boolean;
  minHeight?: number;
};

const logoSize = "h-8 w-8 min-h-[32px] min-w-[32px] shrink-0";

/** Sit-out / bye seat using the same card chrome as a matchup. */
export function BracketByeCard({
  seed,
  title,
  teamName,
  team,
  footnote,
  muted = false,
  minHeight,
}: BracketByeCardProps) {
  const surface = muted
    ? "bg-zinc-100/95 dark:bg-zinc-800/80"
    : `${brandCardGradientClass(seed)} dark:bg-none dark:bg-zinc-900/85`;

  return (
    <article
      className={`w-full rounded-2xl border border-white/45 px-3 py-2 shadow-[0_8px_30px_rgb(0,0,0,0.06)] backdrop-blur-md dark:border-zinc-600/55 dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] ${surface} ${
        muted ? "border-l-2 border-l-zinc-300 opacity-50" : "border-l-2 border-l-royal/90"
      }`}
      style={minHeight != null ? { minHeight } : undefined}
      aria-label={title}
    >
      <p className="text-center text-[11px] font-semibold leading-snug text-zinc-600 dark:text-zinc-400">
        {title}
      </p>
      <div className="mt-1.5 flex items-center justify-center gap-2">
        <TeamLogoMark team={team} sizeClass={logoSize} />
        <p
          data-bracket-team-name
          className={`text-sm leading-[1.15] ${BRACKET_TEAM_NAME_CLASS} ${
            teamName === "TBD" ? "font-medium italic text-zinc-500" : "font-bold text-zinc-900 dark:text-zinc-100"
          }`}
        >
          {teamName}
        </p>
      </div>
      {footnote ? (
        <p className="mt-1.5 text-center text-[10px] italic leading-snug text-zinc-500">{footnote}</p>
      ) : null}
    </article>
  );
}
