/** Display/query string for a location’s mailing address. */
export function formatLocationAddress(loc: { address?: string | null }): string {
  return loc.address?.trim() ?? "";
}

/** @deprecated Use formatLocationAddress */
export function formatVenueAddress(loc: { address?: string | null }): string {
  return formatLocationAddress(loc);
}
