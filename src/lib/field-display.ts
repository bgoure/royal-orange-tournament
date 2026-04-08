/** Public display: "Diamond 1 – Milton Sports Park" */
export function formatFieldWithLocation(fieldName: string, locationName?: string | null): string {
  const loc = locationName?.trim();
  if (loc) return `${fieldName} – ${loc}`;
  return fieldName;
}
