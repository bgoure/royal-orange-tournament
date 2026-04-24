"use client";

import { type KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { useFavorites } from "@/hooks/useFavorites";

export function FavoriteTeamButton({
  tournamentId,
  teamId,
  teamName,
  divisionId,
  className = "",
}: {
  tournamentId: string;
  teamId: string;
  teamName?: string;
  /** Division tab scope for “My Team” (one favorite per division). Omit to hide control. */
  divisionId?: string | null;
  className?: string;
}) {
  const { tournamentId: ctxTournamentId, getFavoriteTeamIdForDivision, toggleFavorite, isLoaded } = useFavorites();

  if (ctxTournamentId !== tournamentId) {
    return <div className={`h-5 w-5 shrink-0 ${className || ""}`.trim()} aria-hidden />;
  }

  if (!isLoaded) {
    return <div className={`h-5 w-5 shrink-0 ${className || ""}`.trim()} aria-hidden />;
  }

  const div = divisionId?.trim() ?? "";
  if (!div) {
    return <div className={`h-5 w-5 shrink-0 ${className || ""}`.trim()} aria-hidden />;
  }

  const isFavorited = getFavoriteTeamIdForDivision(div) === teamId;
  const label = teamName?.trim() || "team";

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label={isFavorited ? `Unfavorite ${label}` : `Favorite ${label}`}
      aria-pressed={isFavorited}
      whileTap={{ scale: 0.8 }}
      className={`inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-white ${className || ""}`.trim()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(teamId, div, label);
      }}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          toggleFavorite(teamId, div, label);
        }
      }}
    >
      {isFavorited ? (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-accent drop-shadow-sm" aria-hidden>
          <path
            fillRule="evenodd"
            d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="h-5 w-5 text-zinc-400 transition-colors hover:text-zinc-500"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385c.148.621-.531 1.121-1.066.82l-4.81-2.738a.562.562 0 00-.54 0l-4.81 2.738c-.535.301-1.214-.199-1.066-.82l1.285-5.385a.563.563 0 00-.182-.557l-4.204-3.602c-.38-.325-.178-.948.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
          />
        </svg>
      )}
    </motion.div>
  );
}
