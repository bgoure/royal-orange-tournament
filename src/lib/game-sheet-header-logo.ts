/** Cache-busting query keeps browsers from showing a stale image after replace. */
export function gameSheetHeaderLogoUrl(tournamentId: string, updatedAt: Date | string): string {
  const v = typeof updatedAt === "string" ? new Date(updatedAt).getTime() : updatedAt.getTime();
  return `/api/game-sheet-logo/${tournamentId}?v=${v}`;
}

export function resolveGameSheetHeaderLogoUrl(args: {
  tournamentId: string;
  gameSheetLogoRightUrl: string | null;
  gameSheetHeaderLogo: { updatedAt: Date } | null | undefined;
}): string | null {
  if (args.gameSheetHeaderLogo) {
    return gameSheetHeaderLogoUrl(args.tournamentId, args.gameSheetHeaderLogo.updatedAt);
  }
  return args.gameSheetLogoRightUrl;
}
