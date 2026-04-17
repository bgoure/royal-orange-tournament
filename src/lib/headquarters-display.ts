/** Valid Canadian province/territory codes (2-letter). */
const CA_PROVINCE_CODES = new Set([
  "AB",
  "BC",
  "MB",
  "NB",
  "NL",
  "NS",
  "NT",
  "NU",
  "ON",
  "PE",
  "QC",
  "SK",
  "YT",
]);

/** Longest-first full names → abbreviation (English). */
const CA_PROVINCE_FULL: Array<[string, string]> = [
  ["newfoundland and labrador", "NL"],
  ["northwest territories", "NT"],
  ["prince edward island", "PE"],
  ["british columbia", "BC"],
  ["new brunswick", "NB"],
  ["nova scotia", "NS"],
  ["saskatchewan", "SK"],
  ["manitoba", "MB"],
  ["ontario", "ON"],
  ["alberta", "AB"],
  ["quebec", "QC"],
  ["yukon", "YT"],
  ["nunavut", "NU"],
];

function parseProvinceFromLastSegment(last: string): string | null {
  const s = last.trim();
  if (!s) return null;

  const twoLetter = s.match(/^([A-Za-z]{2})(?:\s|$)/);
  if (twoLetter) {
    const code = twoLetter[1]!.toUpperCase();
    if (CA_PROVINCE_CODES.has(code)) return code;
  }

  const lower = s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  for (const [full, abbr] of CA_PROVINCE_FULL) {
    if (lower === full || lower.startsWith(full + " ")) return abbr;
  }

  return null;
}

/**
 * Extract city and province/state from a comma-separated address
 * (e.g. "123 Main St, Milton, ON L9T 1X1" or "Milton, Ontario").
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
  const provinceAbbr = parseProvinceFromLastSegment(last);
  if (!provinceAbbr) return null;

  const city = parts[parts.length - 2]!.trim();
  if (!city) return null;

  return { city, provinceAbbr };
}

/** Home hero line: "Venue name - City, PR" when address parses; otherwise venue name only. */
export function formatHeadquartersHomeLabel(
  location: {
    name: string;
    address: string | null;
  },
  /** When HQ `address` is empty or does not parse, try tournament `locationLabel` (often "City, ON"). */
  fallbackAddressLine?: string | null,
): string {
  const displayName = location.name.trim() || "Tournament headquarters";
  const parsed =
    parseCityProvinceFromAddress(location.address) ?? parseCityProvinceFromAddress(fallbackAddressLine);
  if (!parsed) return displayName;
  return `${displayName} - ${parsed.city}, ${parsed.provinceAbbr}`;
}
