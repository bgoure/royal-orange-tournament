"use client";

import { useMemo } from "react";
import type { BracketRound } from "@prisma/client";
import { DIVISION_SWIPE_IGNORE } from "@/lib/division-swipe-ignore";
import { EspnMatchCard } from "@/components/brackets/EspnMatchCard";
import { CollapsedRoundStrip } from "@/components/brackets/CollapsedRoundStrip";
import { useRoundFocus } from "@/components/brackets/use-round-focus";
import type { GameRow } from "@/components/brackets/bracket-types";
import { matchSortIndex } from "@/components/brackets/bracket-slot-lines";
import { BRACKET_COL_DEFAULT_PX } from "@/components/brackets/bracket-card-layout";
import {
  espnConnectorGroups,
  espnRoundsHalveCleanly,
  type EspnConnectorGroup,
} from "@/lib/brackets/espn-bracket-layout";
import { latestScoredColumnIndex } from "@/lib/brackets/bracket-round-window";
import { roundTypeShortLabel } from "@/lib/brackets/bracket-display";
import { withBracketRoundDay } from "@/lib/datetime-tournament";

const CONNECTOR_W = 40;
const HEADER_H = 52;
const MATCH_GAP = 10;

/**
 * ESPN-style single-elimination tree: equal flex slots per round so each
 * later match sits between its feeders, with pure-CSS elbow connectors
 * (no SVG — Safari / iOS safe).
 */
export function EspnStyleBracket({
  byRound,
  roundsOrdered,
  timeZone,
  showHomeAway = true,
  fitContent = false,
  expandAll = false,
  persistKey,
}: {
  byRound: Map<string, GameRow[]>;
  roundsOrdered: BracketRound[];
  timeZone?: string | null;
  showHomeAway?: boolean;
  fitContent?: boolean;
  expandAll?: boolean;
  persistKey?: string;
}) {
  const gamesPerRound = useMemo(
    () =>
      roundsOrdered.map((r) =>
        [...(byRound.get(r.id) ?? [])].sort((a, b) => matchSortIndex(a) - matchSortIndex(b)),
      ),
    [byRound, roundsOrdered],
  );

  const activeIndex = latestScoredColumnIndex(
    gamesPerRound.map((games) => ({ games })),
  );
  const focus = useRoundFocus(
    roundsOrdered.length,
    activeIndex,
    expandAll || fitContent,
    expandAll || fitContent ? undefined : persistKey,
  );

  const openIndices = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < roundsOrdered.length; i++) {
      if (focus.isOpen(i)) out.push(i);
    }
    return out;
  }, [focus, roundsOrdered.length]);

  const useFlexTree = espnRoundsHalveCleanly(gamesPerRound.map((g) => g.length));

  return (
    <div
      {...{ [DIVISION_SWIPE_IGNORE]: "" }}
      className={`flex w-max items-stretch gap-0 overflow-visible pb-2 ${fitContent ? "" : "mt-4"}`}
      role="region"
      aria-label="ESPN-style bracket"
      data-espn-bracket=""
    >
      {roundsOrdered.map((r, ri) => {
        if (!focus.isOpen(ri)) {
          return (
            <CollapsedRoundStrip
              key={r.id}
              label={r.name}
              onExpand={() => focus.toggle(ri)}
            />
          );
        }

        const games = gamesPerRound[ri] ?? [];
        const prevRoundName = ri > 0 ? roundsOrdered[ri - 1]!.name : null;
        const openPos = openIndices.indexOf(ri);
        const prevOpenRi = openPos > 0 ? openIndices[openPos - 1]! : null;
        const showConnector =
          prevOpenRi != null && prevOpenRi === ri - 1 && games.length > 0;
        const connectorGroups = showConnector
          ? espnConnectorGroups(gamesPerRound[prevOpenRi!] ?? [], games)
          : [];

        return (
          <div key={r.id} className="flex shrink-0 items-stretch">
            {showConnector ? (
              <EspnConnectorColumn
                groups={connectorGroups}
                laterCount={games.length}
                earlierCount={(gamesPerRound[prevOpenRi!] ?? []).length}
                useFlexTree={useFlexTree}
              />
            ) : null}
            <div
              className="flex shrink-0 flex-col"
              style={{ width: BRACKET_COL_DEFAULT_PX }}
            >
              <div
                className="mb-2 shrink-0 text-center"
                style={{ height: HEADER_H }}
              >
                <h3 className="border-b border-royal/30 pb-1 text-xs font-bold uppercase tracking-[0.06em] text-royal">
                  {withBracketRoundDay(r.name, games, timeZone)}
                </h3>
                <p className="mt-1 text-[11px] font-medium text-zinc-600">
                  {roundTypeShortLabel(r.roundType)}
                </p>
                {!(expandAll || fitContent) ? (
                  <button
                    type="button"
                    className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 hover:text-royal"
                    onClick={() => focus.toggle(ri)}
                  >
                    (-)
                  </button>
                ) : null}
              </div>

              <div
                className={
                  useFlexTree
                    ? "flex min-h-0 flex-1 flex-col"
                    : "flex min-h-0 flex-1 flex-col justify-around"
                }
                style={useFlexTree ? { gap: MATCH_GAP } : undefined}
              >
                {games.length === 0 ? (
                  <p className="text-sm text-zinc-500">Matchups TBA.</p>
                ) : (
                  games.map((g, mi) => (
                    <div
                      key={g.id}
                      className={
                        useFlexTree
                          ? "flex flex-1 flex-col justify-center"
                          : "flex flex-col justify-center py-2"
                      }
                      data-espn-slot=""
                      data-game-id={g.id}
                    >
                      <EspnMatchCard
                        game={g}
                        roundIndexDb={r.roundIndex}
                        matchIndex={mi}
                        prevRoundName={prevRoundName}
                        timeZone={timeZone}
                        showHomeAway={showHomeAway}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Pure-CSS elbow connectors between two open rounds.
 * Each group gets an equal flex share matching the destination match slot.
 */
function EspnConnectorColumn({
  groups,
  laterCount,
  earlierCount,
  useFlexTree,
}: {
  groups: EspnConnectorGroup[];
  laterCount: number;
  earlierCount: number;
  useFlexTree: boolean;
}) {
  // Pad so connector flex shares mirror later-round slots even if a match has no feeders.
  const slots = Math.max(laterCount, groups.length, 1);

  return (
    <div
      className="relative flex shrink-0 flex-col"
      style={{ width: CONNECTOR_W, paddingTop: HEADER_H + 8 }}
      aria-hidden
      data-espn-connectors=""
      data-earlier-count={earlierCount}
    >
      {Array.from({ length: slots }, (_, i) => {
        const group = groups[i];
        const feederCount = group?.fromGameIds.length ?? 0;
        return (
          <div
            key={group?.toGameId ?? `empty-${i}`}
            className={useFlexTree ? "relative flex-1" : "relative min-h-[72px] flex-1"}
            style={useFlexTree ? { marginTop: i === 0 ? 0 : MATCH_GAP } : undefined}
          >
            {feederCount >= 2 ? (
              <MergeElbow />
            ) : feederCount === 1 ? (
              <StraightJoin />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Two feeders merge into one: ┌─┐ style with a center stem out. */
function MergeElbow() {
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Top feeder horizontal + half vertical */}
      <div
        className="absolute right-0 border-t-2 border-r-2 border-zinc-400 dark:border-zinc-500"
        style={{
          top: "25%",
          height: "25%",
          width: "55%",
          borderTopLeftRadius: 0,
        }}
      />
      {/* Bottom feeder horizontal + half vertical */}
      <div
        className="absolute right-0 border-b-2 border-r-2 border-zinc-400 dark:border-zinc-500"
        style={{
          top: "50%",
          height: "25%",
          width: "55%",
        }}
      />
      {/* Stem to next match */}
      <div
        className="absolute top-1/2 border-t-2 border-zinc-400 dark:border-zinc-500"
        style={{ left: "45%", right: 0, transform: "translateY(-50%)" }}
      />
    </div>
  );
}

/** Single feeder continues straight across. */
function StraightJoin() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center">
      <div className="h-0 w-full border-t-2 border-zinc-400 dark:border-zinc-500" />
    </div>
  );
}
