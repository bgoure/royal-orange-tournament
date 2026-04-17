import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatHeadquartersHomeLabel, parseCityProvinceFromAddress } from "./headquarters-display";

describe("parseCityProvinceFromAddress", () => {
  it("parses city and province before postal code", () => {
    assert.deepEqual(parseCityProvinceFromAddress("123 Main St, Milton, ON L9T 1X1"), {
      city: "Milton",
      provinceAbbr: "ON",
    });
  });
  it("parses two-part address", () => {
    assert.deepEqual(parseCityProvinceFromAddress("Milton, ON"), {
      city: "Milton",
      provinceAbbr: "ON",
    });
  });
  it("parses full province name Ontario", () => {
    assert.deepEqual(parseCityProvinceFromAddress("100 King St, Milton, Ontario L9T 1X1"), {
      city: "Milton",
      provinceAbbr: "ON",
    });
  });
  it("returns null without comma address", () => {
    assert.equal(parseCityProvinceFromAddress("Milton ON"), null);
  });
});

describe("formatHeadquartersHomeLabel", () => {
  it("joins name with parsed city and province", () => {
    assert.equal(
      formatHeadquartersHomeLabel({
        name: "Lions Sports Park",
        address: "100 King St, Milton, ON",
      }),
      "Lions Sports Park - Milton, ON",
    );
  });
  it("uses tournament locationLabel when HQ address is empty", () => {
    assert.equal(
      formatHeadquartersHomeLabel({ name: "Lions Sports Park", address: null }, "Milton, ON"),
      "Lions Sports Park - Milton, ON",
    );
  });
  it("falls back to name only when nothing parses", () => {
    assert.equal(
      formatHeadquartersHomeLabel({ name: "HQ Park", address: null }, null),
      "HQ Park",
    );
  });
});
