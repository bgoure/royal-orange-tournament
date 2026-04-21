import { GameKind } from "@prisma/client";
import { formatBracketGameScheduledAt } from "@/lib/datetime-tournament";
import { brandCardGradientClass } from "@/lib/brand-card-gradient";
import { poolCardLabelTextClass } from "@/lib/pool-card-label";
import { TeamLogoMark } from "@/components/ui/TeamLogo";
import { GAME_CARD_STATUS_STYLES } from "@/components/schedule/GameList";
import type { GameRow } from "@/components/brackets/bracket-types";
import { getBracketSlotSources } from "@/lib/brackets/game-slot-sources";
import { slotLines, slotLineTextClass } from "@/components/brackets/bracket-slot-lines";

const scheduleLogoSize = "h-7 w-7 min-h-[28px] min-w-[28px] shrink-0";
const scoredLogoSize = "h-7 w-7 min-h-[28px] min-w-[28px]";

function bracketGameIdLabel(game: GameRow, listIndexZeroBased: number): string {
  const n = game.gameNumber?.trim();
  if (n) return `G${n}`;
  return `G${listIndexZeroBased + 1}`;
}

export function BracketGameCard({
  game,
  roundIndexDb,
  matchIndex,
  prevRoundName,
  timeZone,
  roundLabel,
  /** When many rounds are flattened into one list, use this for the orange G# chip fallback (otherwise `matchIndex` is used). */
  gLabelFallbackIndexZeroBased,
}: {
  game: GameRow;
  /** BracketRound.roundIndex from DB (not index in UI column list). */
  roundIndexDb: number;
  matchIndex: number;
  prevRoundName: string | null;
  timeZone?: string | null;
  /** Mobile list / consolation: show round name above the time row. Omitted in grid columns (round is the column heading). */
  roundLabel?: string | null;
  gLabelFallbackIndexZeroBased?: number;
}) {
  const bm = game.bracketMatch;
  const bracketMatchIndex = bm?.matchIndex ?? matchIndex;
  const gChipIndex = gLabelFallbackIndexZeroBased ?? matchIndex;
  const src = getBracketSlotSources(game);
  const away = slotLines(
    game.awayTeam,
    src.awayPool,
    src.awayRank,
    roundIndexDb,
    bracketMatchIndex,
    "away",
    prevRoundName,
  );
  const home = slotLines(
    game.homeTeam,
    src.homePool,
    src.homeRank,
    roundIndexDb,
    bracketMatchIndex,
    "home",
    prevRoundName,
  );

  const st = GAME_CARD_STATUS_STYLES[game.status] ?? GAME_CARD_STATUS_STYLES.SCHEDULED;
  const isLive = game.status === "LIVE";
  const leftBorder = isLive
    ? "border-l-2 border-l-red-500 shadow-[0_0_12px_rgba(239,68,68,0.35)]"
    : "border-l-2 border-l-royal/90";

  const surfaceGradient = brandCardGradientClass(game.id);
  const cardPadding = "px-3 py-2";

  const showScheduleStatusPill = game.status !== "SCHEDULED" && game.status !== "LIVE";
  const showLivePill = isLive;

  const metaTopRight = (
    <div className="flex min-w-0 max-w-[min(100%,14rem)] flex-wrap items-center justify-end gap-x-1.5 gap-y-1 text-[10px] leading-tight text-zinc-500 sm:max-w-[55%]">
      {showLivePill ? (
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${st} ring-2 ring-red-400/50`}
        >
          LIVE
        </span>
      ) : null}
      {showScheduleStatusPill ? (
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${st}`}>
          {game.status}
        </span>
      ) : null}
      <span className="inline-flex flex-wrap items-center justify-end gap-x-1.5">
        {game.pool ? (
          <>
            <span className={`font-medium ${poolCardLabelTextClass(game.pool.cardLabelColor)}`}>{game.pool.name}</span>
            <span className="text-zinc-400">·</span>
          </>
        ) : game.gameKind === GameKind.CONSOLATION && game.division ? (
          <>
            <span className="font-medium text-zinc-600">
              {game.division.name} · Friendly consolation
            </span>
            <span className="text-zinc-400">·</span>
          </>
        ) : null}
        <span className="min-w-0 break-words text-right">{game.field.name}</span>
        <span className="text-zinc-400">·</span>
        <span className="inline-block shrink-0 rounded-md bg-accent px-2 py-0.5 text-[11px] font-bold tabular-nums text-white">
          {bracketGameIdLabel(game, gChipIndex)}
        </span>
      </span>
    </div>
  );

  const timeLine = formatBracketGameScheduledAt(game.scheduledAt, timeZone, game.schedulePlaceholder);

  const hasScore = game.status === "FINAL" && game.homeRuns != null && game.awayRuns != null;

  return (
    <article
      className={`min-w-0 rounded-2xl border border-zinc-200 shadow-[0_1px_3px_rgba(0,0,0,0.1)] ${surfaceGradient} ${leftBorder} ${cardPadding}`}
      aria-label={`Bracket match ${gChipIndex + 1}`}
    >
      {roundLabel ? (
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.06em] text-royal">{roundLabel}</p>
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-[13px] font-bold leading-snug text-zinc-900">{timeLine}</p>
        {metaTopRight}
      </div>

      {hasScore ? (
        <div className="mt-1.5 space-y-1">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <TeamLogoMark team={away.team} sizeClass={scoredLogoSize} />
              <p className={`min-w-0 truncate text-xs font-bold leading-snug text-zinc-900 ${slotLineTextClass(away)}`}>
                {away.primary}
              </p>
            </div>
            <span className="shrink-0 text-base font-bold tabular-nums text-zinc-900">{game.awayRuns}</span>
          </div>
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <TeamLogoMark team={home.team} sizeClass={scoredLogoSize} />
              <p className={`min-w-0 truncate text-xs font-bold leading-snug text-zinc-900 ${slotLineTextClass(home)}`}>
                {home.primary}
              </p>
            </div>
            <span className="shrink-0 text-base font-bold tabular-nums text-zinc-900">{game.homeRuns}</span>
          </div>
        </div>
      ) : (
        <div className="mt-1.5 flex min-w-0 items-start gap-1.5 sm:gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-1.5">
            <TeamLogoMark team={away.team} sizeClass={scheduleLogoSize} />
            <div className="min-w-0 flex-1">
              <p
                className={`line-clamp-2 break-words text-sm leading-[1.15] ${slotLineTextClass(away)}`}
              >
                {away.primary}
              </p>
              {away.secondary ? <p className="mt-0.5 text-xs text-zinc-500">{away.secondary}</p> : null}
            </div>
          </div>
          <span className="shrink-0 self-center text-sm font-normal text-accent">vs</span>
          <div className="flex min-w-0 flex-1 items-start justify-end gap-1.5">
            <div className="min-w-0 flex-1 text-right">
              <p
                className={`line-clamp-2 break-words text-sm leading-[1.15] ${slotLineTextClass(home)}`}
              >
                {home.primary}
              </p>
              {home.secondary ? <p className="mt-0.5 text-xs text-zinc-500">{home.secondary}</p> : null}
            </div>
            <TeamLogoMark team={home.team} sizeClass={scheduleLogoSize} />
          </div>
        </div>
      )}
    </article>
  );
}
