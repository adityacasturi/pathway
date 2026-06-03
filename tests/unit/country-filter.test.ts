import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCountryFilterOptions,
  canonicalCountryCode,
  countriesFromLocationField,
  formatCountryCode,
  matchesCountryFilter,
  normalizeCountryCodes,
} from "../../lib/feed/country-filter.ts";

test("formatCountryCode returns standardized English names", () => {
  assert.equal(formatCountryCode("US"), "United States");
  assert.equal(formatCountryCode("USA"), "United States");
  assert.equal(formatCountryCode("GB"), "United Kingdom");
  assert.equal(formatCountryCode("UK"), "United Kingdom");
  assert.equal(formatCountryCode("CN"), "China");
});

test("canonicalCountryCode merges country name variants", () => {
  assert.equal(canonicalCountryCode("USA"), "US");
  assert.equal(canonicalCountryCode("United States"), "US");
  assert.equal(canonicalCountryCode("china mainland"), "CN");
  assert.equal(canonicalCountryCode("China"), "CN");
  assert.equal(canonicalCountryCode("UK"), "GB");
});

test("normalizeCountryCodes dedupes variants on one posting", () => {
  assert.deepEqual(normalizeCountryCodes(["US", "USA", "United States"]), ["US"]);
  assert.deepEqual(normalizeCountryCodes(["CN", "china mainland"]), ["CN"]);
});

test("countriesFromLocationField detects ISO codes from location strings", () => {
  assert.deepEqual(countriesFromLocationField("San Francisco, CA"), ["US"]);
  assert.deepEqual(countriesFromLocationField("London, UK"), ["GB"]);
});

test("matchesCountryFilter passes when no countries selected", () => {
  assert.equal(matchesCountryFilter(["US"], new Set()), true);
});

test("matchesCountryFilter treats variant codes as the same country", () => {
  assert.equal(matchesCountryFilter(["USA"], new Set(["US"])), true);
  assert.equal(matchesCountryFilter(["GB"], new Set(["US"])), false);
  assert.equal(matchesCountryFilter([], new Set(["US"])), false);
});

test("buildCountryFilterOptions merges variants and sorts by count", () => {
  const options = buildCountryFilterOptions(
    new Map([
      ["GB", 2],
      ["US", 3],
      ["USA", 2],
      ["CN", 4],
      ["china mainland", 1],
      ["CA", 1],
    ]),
  );
  assert.deepEqual(
    options.map((option) => option.code),
    ["CN", "US", "GB", "CA"],
  );
  assert.equal(options[0].label, "China");
  assert.equal(options[0].count, 5);
  assert.equal(options[1].label, "United States");
  assert.equal(options[1].count, 5);
});
