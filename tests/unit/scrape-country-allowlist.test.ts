import assert from "node:assert/strict";
import test from "node:test";
import { CountryAllowlist } from "../../lib/scraping/country-allowlist.ts";

const TIER1 = ["US", "CA", "GB", "CH", "SG", "AU"];
const allowlist = new CountryAllowlist(TIER1);

for (const code of TIER1) {
  test(`tier-1 country ${code} is allowed`, () => {
    const result = allowlist.check([code]);
    assert.equal(result.allowed, true);
  });
}

test("empty countries array → country_unknown", () => {
  const result = allowlist.check([]);
  assert.equal(result.allowed, false);
  if (!result.allowed) assert.equal(result.reason, "country_unknown");
});

for (const code of ["MX", "IN", "BR", "PH", "ID"]) {
  test(`non-tier-1 country ${code} → country_not_allowed`, () => {
    const result = allowlist.check([code]);
    assert.equal(result.allowed, false);
    if (!result.allowed) assert.equal(result.reason, "country_not_allowed");
  });
}

test("multi-country with at least one allowed → allowed", () => {
  const result = allowlist.check(["MX", "US"]);
  assert.equal(result.allowed, true);
});

test("multi-country with none allowed → country_not_allowed", () => {
  const result = allowlist.check(["MX", "BR"]);
  assert.equal(result.allowed, false);
  if (!result.allowed) assert.equal(result.reason, "country_not_allowed");
});

test("country codes are compared case-insensitively", () => {
  assert.equal(allowlist.check(["us"]).allowed, true);
  assert.equal(allowlist.check(["gb"]).allowed, true);
});
