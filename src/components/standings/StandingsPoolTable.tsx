"use client";

import type { Division, Pool, PoolCardLabelColor, PoolStanding } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
import { DIVISION_SWIPE_IGNORE } from "@/lib/division-swipe-ignore";
import { TeamLogoMark } from "@/components/ui/TeamLogo";
import {
  poolStandingsExpandStripClass,
  poolStandingsPtsCellClass,
  poolStandingsTableHeaderClass,
} from "@/lib/pool-card-label";
import type { TeamWithPublicLogo } from "@/lib/team-logo";

type Row = PoolStanding & { team: TeamWithPublicLogo };
type PoolWith = Pool & {
  division: Division;
  standings: Row[];
};

/** Fixed widths for W / L / T / Pts — stable when extra columns appear. */
const COL_W = "w-[2.75rem]";
const COL_PTS = "w-[3.25rem]";
const COL_EXTRA = "w-[3.5rem]";
const COL_RA_DI = "w-[4rem]";

function fmtRatio(num: number, den: number): string {
  if (den <= 0) return "—";
  return (num / den).toFixed(2);
}

function fmtInnings(inn: number): string {
  if (Number.isInteger(inn)) return String(inn);
  return inn.toFixed(1);
}

export function StandingsPoolTable({
  pool,
  standingsColor,
}: {
  pool: PoolWith;
  standingsColor: PoolCardLabelColor;
}) {
  const [expanded, setExpanded] = useState(false);

  const expand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(true);
  }, []);

  const collapse = useCallback(() => {
    setExpanded(false);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const extraHeaderClass = expanded ? "table-cell" : "hidden";
  const extraCellClass = expanded ? "table-cell" : "hidden";

  return (
    <div
      className={`flex overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm ${
        expanded ? "ring-2 ring-royal/20" : ""
      }`}
    >
      <div {...{ [DIVISION_SWIPE_IGNORE]: "" }} className="min-w-0 flex-1 overflow-x-auto">
        <table
          className={`table-fixed text-left text-sm ${expanded ? "w-max min-w-full cursor-pointer" : "w-full"}`}
          onClick={expanded ? collapse : undefined}
          role={expanded ? "button" : undefined}
          tabIndex={expanded ? 0 : undefined}
          onKeyDown={
            expanded
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    collapse();
                  }
                }
              : undefined
          }
          aria-expanded={expanded}
          aria-label={expanded ? "Extended standings; activate to collapse" : undefined}
        >
          <colgroup>
            <col />
            <col className={COL_W} />
            <col className={COL_W} />
            <col className={COL_W} />
            <col className={COL_PTS} />
            {expanded ? (
              <>
                <col className={COL_EXTRA} />
                <col className={COL_EXTRA} />
                <col className={COL_EXTRA} />
                <col className={COL_RA_DI} />
              </>
            ) : null}
          </colgroup>
          <thead>
            <tr
              className={`text-[11px] font-bold uppercase tracking-wide ${poolStandingsTableHeaderClass(standingsColor)}`}
            >
              <th className="py-3 pl-3 pr-1">Team</th>
              <th className="px-2 py-3 text-right font-mono">W</th>
              <th className="px-2 py-3 text-right font-mono">L</th>
              <th className="px-2 py-3 text-right font-mono">T</th>
              <th className="px-2 py-3 text-right font-mono">Pts</th>
              <th className={`${extraHeaderClass} px-2 py-3 text-right font-mono`}>RS</th>
              <th className={`${extraHeaderClass} px-2 py-3 text-right font-mono`}>RA</th>
              <th className={`${extraHeaderClass} px-2 py-3 text-right font-mono`}>DI</th>
              <th className={`${extraHeaderClass} px-2 py-3 text-right font-mono`}>RA/DI</th>
            </tr>
          </thead>
          <tbody>
            {pool.standings.map((s, rowIdx) => (
              <tr
                key={s.id}
                className={`border-b border-zinc-200 text-zinc-700 md:hover:bg-zinc-100/80 ${
                  rowIdx % 2 === 1 ? "bg-[#f9f9f9]" : "bg-white"
                }`}
              >
                <td className="py-2.5 pl-3 pr-1">
                  <span className="inline-flex min-w-0 items-center gap-2 text-sm font-bold text-zinc-900">
                    <TeamLogoMark team={s.team} sizeClass="h-6 w-6 min-h-6 min-w-6 shrink-0" />
                    <span className="min-w-0 truncate">{s.team.name}</span>
                  </span>
                </td>
                <td className="px-2 py-2.5 text-right font-mono tabular-nums font-semibold">{s.wins}</td>
                <td className="px-2 py-2.5 text-right font-mono tabular-nums">{s.losses}</td>
                <td className="px-2 py-2.5 text-right font-mono tabular-nums">{s.ties}</td>
                <td
                  className={`px-2 py-2.5 text-right font-mono tabular-nums font-bold ${poolStandingsPtsCellClass(standingsColor)}`}
                >
                  {s.points}
                </td>
                <td className={`${extraCellClass} px-2 py-2.5 text-right font-mono tabular-nums`}>
                  {s.runsFor}
                </td>
                <td className={`${extraCellClass} px-2 py-2.5 text-right font-mono tabular-nums`}>
                  {s.runsAgainst}
                </td>
                <td className={`${extraCellClass} px-2 py-2.5 text-right font-mono tabular-nums`}>
                  {fmtInnings(s.defensiveInnings)}
                </td>
                <td
                  className={`${extraCellClass} px-2 py-2.5 text-right font-mono tabular-nums text-zinc-500`}
                >
                  {fmtRatio(s.runsAgainst, s.defensiveInnings)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!expanded ? (
        <button
          type="button"
          className={[
            "flex w-11 shrink-0 flex-col items-center justify-center text-lg font-semibold leading-none transition",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset",
            standingsColor === "AMBER" ? "hover:brightness-95" : "hover:brightness-110",
            poolStandingsExpandStripClass(standingsColor),
          ].join(" ")}
          aria-label="Show runs, innings, and ratio columns"
          aria-expanded={false}
          onClick={expand}
        >
          +
        </button>
      ) : null}
    </div>
  );
}
