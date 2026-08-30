/** Wizard fallback when a division was not named (`Division1`, `Division2 Playoffs`, …). */
export function isGenericWizardDivisionTitle(name: string): boolean {
  return /^Division\s*\d+(\s+Playoffs)?$/i.test(name.trim());
}

/** Prefer a real division name over the wizard’s Division1 heading. */
export function publicBracketHeading(bracketName: string, divisionName: string): string {
  const name = bracketName.trim();
  const div = divisionName.trim();
  if (!name) return div;
  if (isGenericWizardDivisionTitle(name) && div && !isGenericWizardDivisionTitle(div)) {
    return div;
  }
  return name;
}
