import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasMapLinkAvailability, shortAddress } from "./venue-summary";

describe("shortAddress", () => {
  it("returns empty for missing", () => {
    assert.equal(shortAddress(null), "");
    assert.equal(shortAddress("  "), "");
  });

  it("uses the first line", () => {
    assert.equal(shortAddress("123 Main St\nAustin, TX"), "123 Main St");
  });

  it("truncates long lines", () => {
    const long = "A".repeat(60);
    const out = shortAddress(long, 20);
    assert.ok(out.endsWith("…"));
    assert.ok(out.length <= 20);
  });
});

describe("hasMapLinkAvailability", () => {
  it("true for custom map link", () => {
    assert.equal(hasMapLinkAvailability({ mapLink: "https://maps.example" }), true);
  });

  it("true when both coordinates set", () => {
    assert.equal(hasMapLinkAvailability({ latitude: 30, longitude: -97 }), true);
  });

  it("false when only one coordinate", () => {
    assert.equal(hasMapLinkAvailability({ latitude: 30, longitude: null }), false);
  });

  it("false when nothing set", () => {
    assert.equal(hasMapLinkAvailability({}), false);
  });
});
