/** Public URL for a tournament sponsor image (served from `/api/sponsor-logo/...`). */
export function sponsorLogoUrl(sponsorId: string, updatedAt: Date): string {
  const v = updatedAt.getTime();
  return `/api/sponsor-logo/${encodeURIComponent(sponsorId)}?v=${v}`;
}
