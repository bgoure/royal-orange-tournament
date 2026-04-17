/**
 * Extract city and 2-letter province/state from a comma-separated street address
 * (e.g. "123 Main St, Milton, ON L9T 1X1" → Milton, ON).
 */
export function parseCityProvinceFromAddress(address: string | null | undefined): {
  city: string;
  provinceAbbr: string;
} | null {
  if (!address?.trim()) return null;
  const parts = address
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length < 2) return null;

  const last = parts[parts.length - 1]!;
  const provinceMatch = last.match(/^([A-Za-z]{2})(?:\s|$)/);
  if (!provinceMatch) return null;
  const provinceAbbr = provinceMatch[1]!.toUpperCase();

  const city = parts[parts.length - 2]!.trim();
  if (!city) return null;

  return { city, provinceAbbr };
}

/** Home hero line: "Venue name - City, PR" when address parses; otherwise venue name only. */
export function formatHeadquartersHomeLabel(location: {
  name: string;
  address: string | null;
}): string {
  const displayName = location.name.trim() || "Tournament headquarters";
  const parsed = parseCityProvinceFromAddress(location.address);
  if (!parsed) return displayName;
  return `${displayName} - ${parsed.city}, ${parsed.provinceAbbr}`;
}
