import assert from "node:assert/strict";
import test from "node:test";
import {
  expandLocationSegments,
  formatCompactLocationLabel,
  formatCompactLocationSegments,
  formatUsLocations,
  hasUsLocation,
  isUsSegment,
  trimToUsLocations,
} from "../../lib/feed/us-locations.ts";
import { formatPrimaryWithCountryCode } from "../../lib/scraping/location.ts";

test("expandLocationSegments splits stored multi-place strings", () => {
  assert.deepEqual(expandLocationSegments("New York, NY · London, UK"), [
    "New York, NY",
    "London, UK",
  ]);
  assert.deepEqual(expandLocationSegments("San Francisco, CA | Toronto, ON"), [
    "San Francisco, CA",
    "Toronto, ON",
  ]);
});

test("isUsSegment keeps US signals and drops ambiguous or non-US", () => {
  assert.equal(isUsSegment("San Francisco, CA"), true);
  assert.equal(isUsSegment("Remote US"), true);
  assert.equal(isUsSegment("Remote (United States)"), true);
  assert.equal(isUsSegment("London"), false);
  assert.equal(isUsSegment("Toronto, ON"), false);
  assert.equal(isUsSegment("Paris, France"), false);
  assert.equal(isUsSegment("Remote"), false);
  assert.equal(isUsSegment("NYC / London"), false);
});

test("trimToUsLocations keeps US segments and drops non-US", () => {
  assert.deepEqual(trimToUsLocations(["New York, NY · London, UK"]), ["New York, NY"]);
  assert.deepEqual(trimToUsLocations(["San Francisco, CA", "Toronto, ON"]), ["San Francisco, CA"]);
  assert.deepEqual(trimToUsLocations(["London"]), []);
  assert.deepEqual(trimToUsLocations(["Remote US", "Remote"]), ["Remote US"]);
});

test("formatUsLocations joins US segments", () => {
  assert.equal(
    formatUsLocations(["Seattle, WA · London, UK", "Austin, TX"]),
    "Seattle, WA · Austin, TX",
  );
  assert.equal(formatUsLocations(["London"]), null);
});

test("formatCompactLocationLabel caps segments with +N more", () => {
  const many =
    "Jeffersonville, Ohio, USA · Atlanta, Georgia, USA · Herndon, Virginia, USA · Umatilla, Oregon, USA · Columbus, Ohio, USA · Dallas, Texas, USA";
  assert.equal(
    formatCompactLocationLabel(many, 2),
    "Jeffersonville, Ohio, USA · Atlanta, Georgia, USA · +4 more",
  );
  assert.equal(formatCompactLocationSegments(["Austin, TX"], 2), "Austin, TX");
});

test("hasUsLocation reflects trim result", () => {
  assert.equal(hasUsLocation(["San Francisco, CA"]), true);
  assert.equal(hasUsLocation(["London, UK"]), false);
  assert.equal(hasUsLocation(["New York, NY · London, UK"]), true);
});

test("formatPrimaryWithCountryCode keeps non-US country codes", () => {
  assert.deepEqual(formatPrimaryWithCountryCode("London", "GB"), ["London, GB"]);
  assert.deepEqual(formatPrimaryWithCountryCode("New York, NY", "US"), [
    "New York, NY, United States",
  ]);
});

test("classifyScrapeRole keeps international and multi-country locations", async () => {
  const { classifyScrapeRole } = await import("../../lib/scraping/classify-role.ts");

  const international = classifyScrapeRole({
    title: "Software Engineer Intern",
    description: "Build backend services in Go and Python for our platform.",
    locations: ["London, UK"],
  });
  assert.equal(international.reason, "included");

  const multiCountry = classifyScrapeRole({
    title: "Software Engineer Intern",
    description: "Build backend services in Go and Python for our platform.",
    locations: ["Seattle, WA · London, UK"],
  });
  assert.equal(multiCountry.reason, "included");
  assert.deepEqual(multiCountry.locations, ["Seattle, WA", "London, UK"]);
});
