"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { TeamLogoMark } from "@/components/ui/TeamLogo";
import type { TeamWithPublicLogo } from "@/lib/team-logo";

export type ChampionCelebrationProps = {
  tournamentName: string;
  divisionName: string;
  winnerTeam: TeamWithPublicLogo & { name: string };
  className?: string;
};

type ConfettiPiece = {
  id: number;
  leftPct: number;
  delayS: number;
  durationS: number;
  color: string;
  sizePx: number;
  drift: number;
};

const CONFETTI_COLORS = [
  "oklch(0.62 0.19 264)",
  "oklch(0.72 0.15 45)",
  "oklch(0.65 0.2 150)",
  "oklch(0.7 0.12 320)",
  "oklch(0.55 0.08 250)",
];

/** Deterministic 0..1 from index (stable across re-renders). */
function confettiUnit(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Avoid "Name!!" when tournament label already ends with ! or ?. */
function tournamentClosingPhrase(tournamentName: string): string {
  const t = tournamentName.trim();
  if (!t) return "";
  return /[!?.]$/.test(t) ? t : `${t}!`;
}

function ConfettiLayer({ show }: { show: boolean }) {
  const pieces = useMemo((): ConfettiPiece[] => {
    return Array.from({ length: 28 }, (_, i) => ({
      id: i,
      leftPct: confettiUnit(i, 1) * 100,
      delayS: confettiUnit(i, 2) * 1.2,
      durationS: 2.8 + confettiUnit(i, 3) * 2.2,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
      sizePx: 6 + Math.floor(confettiUnit(i, 4) * 6),
      drift: -40 + confettiUnit(i, 5) * 80,
    }));
  }, []);

  if (!show) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-0 rounded-[1px] opacity-90 will-change-transform motion-reduce:hidden"
          style={{
            left: `${p.leftPct}%`,
            width: p.sizePx,
            height: p.sizePx * 0.45,
            backgroundColor: p.color,
            animation: `champion-confetti-fall ${p.durationS}s linear ${p.delayS}s infinite`,
            ["--champion-drift" as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

export function ChampionCelebration({
  tournamentName,
  divisionName,
  winnerTeam,
  className = "",
}: ChampionCelebrationProps) {
  const reduceMotion = useReducedMotion();
  const divisionTournamentBold = `${divisionName.trim()} ${tournamentClosingPhrase(tournamentName)}`.trim();

  return (
    <section
      className={`relative isolate overflow-hidden rounded-2xl border border-royal/25 bg-gradient-to-b from-royal-50/95 via-white to-amber-50/40 px-4 py-6 shadow-md sm:px-6 ${className}`.trim()}
      aria-label={`Champion: ${winnerTeam.name}`}
    >
      <div className="relative z-10 flex flex-col items-stretch">
        <motion.div
          initial={reduceMotion ? false : { y: -6, opacity: 0 }}
          animate={reduceMotion ? undefined : { y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          className="relative min-h-[7.5rem] overflow-hidden rounded-xl border border-zinc-200/90 bg-zinc-50/90 px-3 py-3 sm:min-h-[8.5rem] sm:px-4 sm:py-4"
        >
          <ConfettiLayer show={!reduceMotion} />

          <div className="relative z-10 flex h-full min-h-[6.5rem] flex-row items-center justify-between gap-3 sm:min-h-[7rem]">
            <div className="flex min-w-0 max-w-[45%] flex-1 items-center justify-start sm:max-w-[48%]">
              {winnerTeam.logo ? (
                <TeamLogoMark
                  team={winnerTeam}
                  sizeClass="h-auto max-h-24 w-auto max-w-full sm:max-h-28"
                  className="!h-auto max-h-24 object-contain object-left sm:max-h-28"
                />
              ) : (
                <p className="line-clamp-3 text-left text-sm font-bold leading-tight text-royal sm:text-base">
                  {winnerTeam.name}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center justify-end">
              {/* eslint-disable-next-line @next/next/no-img-element -- static public asset */}
              <img
                src="/championTrophy.png"
                alt=""
                className="h-[5.5rem] w-auto max-w-[min(160px,48%)] object-contain object-right sm:h-32 sm:max-w-[180px]"
              />
            </div>
          </div>
        </motion.div>

        <p className="mx-auto mt-4 max-w-lg text-center text-sm leading-snug text-zinc-800 sm:text-base">
          Congratulations to <strong className="font-bold text-zinc-900">{winnerTeam.name}</strong> for winning the{" "}
          <strong className="font-bold text-royal">{divisionTournamentBold}</strong>
        </p>
      </div>
    </section>
  );
}
