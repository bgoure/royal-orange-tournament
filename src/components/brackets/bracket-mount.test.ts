import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  assertSingleInteractiveTree,
  bracketTreeMounts,
  hasResponsiveVisibilityToggle,
} from "./bracket-mount";

describe("bracketTreeMounts", () => {
  it("returns exactly one mount per bracket", () => {
    assert.equal(bracketTreeMounts("bracket-1").length, 1);
  });

  it("keys the mount by bracket so sibling brackets stay independent", () => {
    assert.notEqual(bracketTreeMounts("a")[0]!.key, bracketTreeMounts("b")[0]!.key);
  });

  it("never gates the mount behind a breakpoint", () => {
    const [mount] = bracketTreeMounts("bracket-1");
    assert.equal(hasResponsiveVisibilityToggle(mount!.className), false);
  });
});

describe("hasResponsiveVisibilityToggle", () => {
  it("flags the duplicate-mount class pairs", () => {
    assert.equal(hasResponsiveVisibilityToggle("mt-4 hidden md:block"), true);
    assert.equal(hasResponsiveVisibilityToggle("mt-4 md:hidden"), true);
    assert.equal(hasResponsiveVisibilityToggle("mt-4 lg:flex"), true);
  });

  it("leaves ordinary layout classes alone", () => {
    assert.equal(hasResponsiveVisibilityToggle("mt-4"), false);
    assert.equal(hasResponsiveVisibilityToggle("relative flex w-max gap-5"), false);
    assert.equal(hasResponsiveVisibilityToggle("overflow-hidden md:gap-6"), false);
  });
});

describe("assertSingleInteractiveTree", () => {
  it("unwraps the single mount", () => {
    const mounts = bracketTreeMounts("bracket-1");
    assert.equal(assertSingleInteractiveTree(mounts), mounts[0]);
  });

  it("rejects a second mount", () => {
    assert.throws(
      () =>
        assertSingleInteractiveTree([
          { key: "desktop", className: "mt-4 hidden md:block" },
          { key: "mobile", className: "mt-4 md:hidden" },
        ]),
      /exactly one interactive tree/,
    );
  });

  it("rejects a lone mount that hides itself at a breakpoint", () => {
    assert.throws(
      () => assertSingleInteractiveTree([{ key: "desktop", className: "mt-4 hidden md:block" }]),
      /duplicate mount/,
    );
  });
});

describe("BracketsView source", () => {
  it("mounts one interactive zoom shell per bracket section", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src", "components", "brackets", "BracketsView.tsx"),
      "utf8",
    );
    const mounts = source.match(/<BracketZoomShell\b/g) ?? [];
    assert.equal(
      mounts.length,
      1,
      "BracketsView must render a single BracketZoomShell — breakpoint duplicates double all bracket measurement work on mobile.",
    );
  });
});
