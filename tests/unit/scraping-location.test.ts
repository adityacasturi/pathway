import assert from "node:assert/strict";
import test from "node:test";
import {
  collapseRepeatedCommaParts,
  formatScrapedLocation,
  isInvalidScrapedLocationToken,
  normalizeScrapedLocationField,
  normalizeScrapedLocations,
} from "../../lib/scraping/location.ts";

test("collapseRepeatedCommaParts dedupes repeated place names", () => {
  assert.equal(collapseRepeatedCommaParts("Singapore, Singapore, Singapore"), "Singapore");
});

test("normalizeScrapedLocationField rejects garbage and company slugs", () => {
  assert.equal(
    normalizeScrapedLocationField("voloridge", { companySlug: "voloridge", companyName: "Voloridge" }),
    null,
  );
  assert.equal(normalizeScrapedLocationField("location"), null);
  assert.equal(normalizeScrapedLocationField("Professional"), null);
  assert.equal(normalizeScrapedLocationField("Asia"), null);
});

test("normalizeScrapedLocationField keeps real places", () => {
  assert.equal(
    normalizeScrapedLocationField("Jupiter, FL", { companySlug: "voloridge" }),
    "Jupiter, FL",
  );
  assert.equal(
    formatScrapedLocation(["Singapore, Singapore, Singapore"]),
    "Singapore",
  );
  assert.equal(
    formatScrapedLocation(["Cambridge, MA, US", "New York, NY, US"]),
    "Cambridge, MA, US · New York, NY, US",
  );
});

test("normalizeScrapedLocations filters employment levels but keeps geographic lists", () => {
  const locations = normalizeScrapedLocations(
    ["Professional", "LOWELL", "San Jose, CA, US", "Austin, TX, US"],
    { companyName: "Example" },
  );
  assert.ok(!locations.includes("Professional"));
  assert.ok(locations.some((loc) => /San Jose/i.test(loc)));
});

test("isInvalidScrapedLocationToken treats company name as non-location", () => {
  assert.equal(
    isInvalidScrapedLocationToken("voloridge", {
      companySlug: "voloridge",
      companyName: "Voloridge",
    }),
    true,
  );
});
