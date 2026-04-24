"use server";

import { listGamesForFavoriteTeamIds } from "@/lib/services/games";

const CUID_LIKE = /^[a-z][a-z0-9]{15,32}$/i;
const MAX_TEAM_IDS = 32;

/** Public read: games involving starred teams for the home “Your teams” strip. */
export async function fetchGamesForFavoriteTeams(
  tournamentId: string,
  divisionTabId: string | null | undefined,
  teamIds: string[],
) {
  const tid = tournamentId.trim();
  if (!tid || tid.length > 64) return [];

  const ids = [...new Set(teamIds.map((x) => x.trim()).filter((x) => CUID_LIKE.test(x)))].slice(0, MAX_TEAM_IDS);
  if (ids.length === 0) return [];

  const div = divisionTabId?.trim();
  return listGamesForFavoriteTeamIds(tid, div && div.length > 0 ? div : undefined, ids);
}
