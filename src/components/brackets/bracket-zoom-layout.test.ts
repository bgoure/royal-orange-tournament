import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  NON_IMMERSIVE_BRACKET_SCROLL_CLASS,
  reservedZoomHeight,
  sameMeasuredHeights,
} from "./bracket-zoom-layout";

describe("bracket-zoom-layout", () => {
  it("reserves ceil(contentH * scale) only when zoomed", () => {
    assert.equal(reservedZoomHeight(400, 1), undefined);
    assert.equal(reservedZoomHeight(0, 0.8), undefined);
    assert.equal(reservedZoomHeight(400, 0.8), 320);
    assert.equal(reservedZoomHeight(401, 0.75), 301);
  });

  it("treats sub-pixel height churn as equal", () => {
    const a = new Map([
      ["g1", 148],
      ["g2", 160],
    ]);
    const b = new Map([
      ["g1", 149],
      ["g2", 161],
    ]);
    assert.equal(sameMeasuredHeights(a, b), true);
    assert.equal(sameMeasuredHeights(a, new Map([["g1", 148], ["g2", 170]])), false);
  });

  it("forces overflow-y-clip on the non-immersive shell scroller (source contract)", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src", "components", "brackets", "BracketZoomShell.tsx"),
      "utf8",
    );
    assert.match(source, /NON_IMMERSIVE_BRACKET_SCROLL_CLASS/);
    assert.doesNotMatch(
      source,
      /immersive \? "[^"]*" : "overflow-x-auto pb-2"/,
      "bare overflow-x-auto recreates nested overflow-y:auto via the CSS visible→auto quirk",
    );
    assert.match(NON_IMMERSIVE_BRACKET_SCROLL_CLASS, /overflow-y-clip/);
    assert.match(NON_IMMERSIVE_BRACKET_SCROLL_CLASS, /overflow-x-auto/);
  });
});
