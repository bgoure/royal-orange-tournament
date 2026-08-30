import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isGenericWizardDivisionTitle, publicBracketHeading } from "@/lib/brackets/bracket-public-title";

describe("publicBracketHeading", () => {
  it("keeps a real bracket title", () => {
    assert.equal(publicBracketHeading("10U AA Playoffs", "10U AA"), "10U AA Playoffs");
  });

  it("replaces wizard Division1 when the division has a real name", () => {
    assert.equal(publicBracketHeading("Division1", "10U AA"), "10U AA");
    assert.equal(publicBracketHeading("Division1 Playoffs", "10U AA"), "10U AA");
  });

  it("leaves Division1 when the division is also generic", () => {
    assert.equal(publicBracketHeading("Division1", "Division1"), "Division1");
  });

  it("detects wizard fallback titles", () => {
    assert.equal(isGenericWizardDivisionTitle("Division1"), true);
    assert.equal(isGenericWizardDivisionTitle("Division 2 Playoffs"), true);
    assert.equal(isGenericWizardDivisionTitle("10U AA"), false);
  });
});
