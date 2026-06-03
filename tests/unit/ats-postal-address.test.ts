import assert from "node:assert/strict";
import test from "node:test";
import {
  formatAtsPostalAddress,
  formatUsAtsPostalAddress,
} from "../../lib/scraping/ats-postal-address.ts";

test("formatAtsPostalAddress joins locality, region, and country", () => {
  assert.equal(
    formatAtsPostalAddress({
      addressLocality: "San Francisco",
      addressRegion: "CA",
      addressCountry: "US",
    }),
    "San Francisco, CA, US",
  );
  assert.equal(formatAtsPostalAddress({}), null);
});

test("formatUsAtsPostalAddress matches formatAtsPostalAddress", () => {
  assert.equal(
    formatUsAtsPostalAddress({
      addressLocality: "London",
      addressCountry: "GB",
    }),
    "London, GB",
  );
  assert.equal(
    formatUsAtsPostalAddress({
      addressLocality: "Austin",
      addressRegion: "TX",
      addressCountry: "US",
    }),
    "Austin, TX, US",
  );
});
