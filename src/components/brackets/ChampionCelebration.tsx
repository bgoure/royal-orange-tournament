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
    <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[min(420px,55vh)] overflow-hidden" aria-hidden>
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

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.35}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 21h8M12 17v4M7 4h10v3a5 5 0 01-10 0V4z" />
      <path d="M7 7H4a2 2 0 000 4h1.5M17 7h3a2 2 0 010 4h-1.5" />
      <path d="M12 11v3" opacity={0.5} />
    </svg>
  );
}

export function ChampionCelebration({
  tournamentName,
  divisionName,
  winnerTeam,
  className = "",
}: ChampionCelebrationProps) {
  const reduceMotion = useReducedMotion();

  return (
    <section
      className={`relative isolate overflow-hidden rounded-2xl border border-royal/25 bg-gradient-to-b from-royal-50/95 via-white to-amber-50/40 px-4 py-6 shadow-md sm:px-6 ${className}`.trim()}
      aria-label={`Champion: ${winnerTeam.name}`}
    >
      <ConfettiLayer show={!reduceMotion} />

      <div className="relative z-10 flex flex-col items-center text-center">
        <motion.div
          initial={reduceMotion ? false : { y: -6, opacity: 0 }}
          animate={reduceMotion ? undefined : { y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          className="mb-3 flex flex-col items-center gap-1"
        >
          <TrophyIcon className="size-14 text-amber-600 drop-shadow-sm sm:size-16" />
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-royal">Champions</p>
        </motion.div>

        <p className="text-base font-semibold text-zinc-800 sm:text-lg">Congratulations to</p>

        <div className="my-4 flex w-full max-w-md justify-center sm:max-w-lg">
          {winnerTeam.logo ? (
            <TeamLogoMark
              team={winnerTeam}
              sizeClass="h-auto w-full max-h-40 sm:max-h-48"
              className="!h-auto max-h-40 w-full max-w-full rounded-lg object-contain ring-2 ring-royal/20 sm:max-h-48"
            />
          ) : (
            <div className="flex min-h-24 w-full max-w-xs items-center justify-center rounded-xl border-2 border-dashed border-royal/25 bg-white/80 px-4 py-6">
              <span className="text-lg font-bold text-royal sm:text-xl">{winnerTeam.name}</span>
            </div>
          )}
        </div>

        {winnerTeam.logo ? (
          <p className="mb-1 text-lg font-bold text-zinc-900 sm:text-xl">{winnerTeam.name}</p>
        ) : null}

        <p className="max-w-md text-sm leading-snug text-zinc-700 sm:text-base">
          for winning the <span className="font-semibold text-zinc-900">{divisionName}</span>{" "}
          <span className="font-semibold text-royal">{tournamentName}</span>
        </p>
      </div>
    </section>
  );
}
