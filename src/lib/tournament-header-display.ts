/** Primary (white) + accent (orange) lines for the public site header title. */
export function publicSiteHeaderTitleLines(tournament: {
  name: string;
  shortLabel: string | null;
}): { primary: string; accent: string } {
  const name = tournament.name.trim();
  const classicYear = name.match(/^(.*?)(\s+Classic\s+(20\d{2}))\s*$/i);
  if (classicYear) {
    return { primary: classicYear[1]!.trim(), accent: classicYear[2]!.trim() };
  }
  const short = tournament.shortLabel?.trim();
  if (short) {
    if (name.includes(short)) {
      const primary = name.replace(short, "").replace(/\s+/g, " ").trim();
      if (primary) return { primary, accent: short };
    }
    return { primary: name, accent: short };
  }
  return { primary: name, accent: "" };
}
