"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { BracketDesktopTree } from "@/components/brackets/BracketsView";
import { BracketGameCard } from "@/components/brackets/BracketGameCard";
import type { BracketWith, GameRow } from "@/components/brackets/bracket-types";
import {
  BRACKET_EXPORT_HEADER_PX,
  BRACKET_EXPORT_MARGIN_PX,
  BRACKET_EXPORT_PAGE_PX_H,
  BRACKET_EXPORT_PAGE_PX_W,
  fitScale,
  waitForExportPaint,
} from "@/lib/brackets/bracket-export";

type Props = {
  brackets: BracketWith[];
  consolationGames: GameRow[];
  tournamentName: string;
  tournamentShortLabel?: string | null;
  divisionName?: string | null;
  headerLogoUrl?: string | null;
  tournamentTimezone?: string | null;
  showHomeAway?: boolean;
  onReady: (pageEl: HTMLElement) => void;
};

export function BracketExportSurface({
  brackets,
  consolationGames,
  tournamentName,
  tournamentShortLabel,
  divisionName,
  headerLogoUrl,
  tournamentTimezone,
  showHomeAway = true,
  onReady,
}: Props) {
  const pageRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 1, w: 0, h: 0 });
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useLayoutEffect(() => {
    const page = pageRef.current;
    const tree = treeRef.current;
    if (!page || !tree) return;
    let cancelled = false;

    void (async () => {
      await waitForExportPaint(page);
      if (cancelled || !treeRef.current) return;
      const el = treeRef.current;
      const natW = Math.max(el.scrollWidth, el.offsetWidth, 1);
      const natH = Math.max(el.scrollHeight, el.offsetHeight, 1);
      const availW = BRACKET_EXPORT_PAGE_PX_W - BRACKET_EXPORT_MARGIN_PX * 2;
      const availH =
        BRACKET_EXPORT_PAGE_PX_H - BRACKET_EXPORT_HEADER_PX - BRACKET_EXPORT_MARGIN_PX;
      setBox({ scale: fitScale(natW, natH, availW, availH), w: natW, h: natH });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    if (box.w < 1) return;
    const page = pageRef.current;
    if (!page) return;
    let cancelled = false;
    void (async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      if (cancelled || !pageRef.current) return;
      onReadyRef.current(pageRef.current);
    })();
    return () => {
      cancelled = true;
    };
  }, [box]);

  const consolationByDivision = new Map<string, GameRow[]>();
  for (const g of consolationGames) {
    if (!g.divisionId) continue;
    const list = consolationByDivision.get(g.divisionId) ?? [];
    list.push(g);
    consolationByDivision.set(g.divisionId, list);
  }

  const subtitle = [divisionName, brackets.length === 1 ? brackets[0]?.name : null]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed top-0 left-[-12000px] z-[-1]"
    >
      <div
        ref={pageRef}
        data-bracket-export-page
        className="relative box-border overflow-hidden bg-white text-zinc-900"
        style={{
          width: BRACKET_EXPORT_PAGE_PX_W,
          height: BRACKET_EXPORT_PAGE_PX_H,
          colorScheme: "only light",
        }}
      >
        <header
          className="flex items-center justify-center gap-5 px-10"
          style={{ height: BRACKET_EXPORT_HEADER_PX }}
        >
          {headerLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- capture surface; next/image taints canvas
            <img
              src={headerLogoUrl}
              alt=""
              crossOrigin={headerLogoUrl.startsWith("/") ? "anonymous" : undefined}
              className="max-h-20 w-auto max-w-[11rem] object-contain"
            />
          ) : null}
          <div className="min-w-0 text-center">
            <p className="text-[1.65rem] font-bold leading-tight tracking-tight text-zinc-900">
              {tournamentName.trim()}
              {tournamentShortLabel?.trim() &&
              !tournamentName.toLowerCase().includes(tournamentShortLabel.trim().toLowerCase())
                ? ` · ${tournamentShortLabel.trim()}`
                : ""}
            </p>
            {subtitle ? (
              <p className="mt-1 text-sm font-semibold uppercase tracking-[0.12em] text-royal">
                {subtitle}
              </p>
            ) : null}
          </div>
        </header>

        <div
          className="flex items-center justify-center overflow-hidden"
          style={{
            height: BRACKET_EXPORT_PAGE_PX_H - BRACKET_EXPORT_HEADER_PX,
            paddingLeft: BRACKET_EXPORT_MARGIN_PX,
            paddingRight: BRACKET_EXPORT_MARGIN_PX,
            paddingBottom: BRACKET_EXPORT_MARGIN_PX,
          }}
        >
          <div
            style={
              box.w > 0
                ? { width: box.w * box.scale, height: box.h * box.scale }
                : undefined
            }
          >
            <div
              ref={treeRef}
              className="bg-white [&_.overflow-x-auto]:w-max [&_.overflow-x-auto]:overflow-visible"
              style={
                box.w > 0
                  ? {
                      width: box.w,
                      transform: `scale(${box.scale})`,
                      transformOrigin: "top left",
                    }
                  : undefined
              }
            >
              <div className="flex w-max flex-col gap-8">
                {brackets.map((b) => {
                  const consolation = (consolationByDivision.get(b.divisionId) ?? []).sort(
                    (a, c) => a.scheduledAt.getTime() - c.scheduledAt.getTime(),
                  );
                  return (
                    <section key={b.id} className="min-w-0">
                      {brackets.length > 1 || b.isQualifier ? (
                        <h2 className="mb-3 border-b-2 border-royal pb-1 text-sm font-bold uppercase tracking-[0.06em] text-royal">
                          {b.name}
                          {b.isQualifier ? ` · qualifier (top ${b.qualifyingTeamCount})` : ""}
                        </h2>
                      ) : null}
                      <BracketDesktopTree
                        b={b}
                        tournamentTimezone={tournamentTimezone}
                        showHomeAway={showHomeAway}
                        fitContent
                      />
                      {consolation.length > 0 ? (
                        <div className="mt-6 border-t border-royal/20 pt-4">
                          <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-royal">
                            Consolation games
                          </h3>
                          <div className="flex flex-col gap-3" style={{ width: 280 }}>
                            {consolation.map((g, mi) => (
                              <BracketGameCard
                                key={g.id}
                                game={g}
                                roundIndexDb={0}
                                matchIndex={mi}
                                prevRoundName={null}
                                timeZone={tournamentTimezone}
                                showHomeAway={showHomeAway}
                              />
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
