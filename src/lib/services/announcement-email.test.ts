import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { subscriberIncludedForAnnouncementEmail } from "./announcement-email";

describe("subscriberIncludedForAnnouncementEmail", () => {
  it("includes null or empty role labels", () => {
    assert.equal(subscriberIncludedForAnnouncementEmail(null), true);
    assert.equal(subscriberIncludedForAnnouncementEmail(""), true);
    assert.equal(subscriberIncludedForAnnouncementEmail("  "), true);
  });
  it("includes coach, manager, director labels", () => {
    assert.equal(subscriberIncludedForAnnouncementEmail("Assistant Coach"), true);
    assert.equal(subscriberIncludedForAnnouncementEmail("MANAGER"), true);
    assert.equal(subscriberIncludedForAnnouncementEmail("League director"), true);
  });
  it("excludes unrelated roles", () => {
    assert.equal(subscriberIncludedForAnnouncementEmail("Parent / fan"), false);
  });
});
