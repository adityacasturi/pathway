import assert from "node:assert/strict";
import test from "node:test";
import { logoCacheKey, logoDomainFromWebsite, logoUrl } from "../../lib/logo.ts";

test("logoDomainFromWebsite strips www and lowercases host", () => {
  assert.equal(logoDomainFromWebsite("https://www.point72.com/about"), "point72.com");
});

test("logoDomainFromWebsite returns null for invalid input", () => {
  assert.equal(logoDomainFromWebsite(null), null);
  assert.equal(logoDomainFromWebsite("not a url"), null);
});

test("logoUrl prefers domain param when provided", () => {
  const url = logoUrl("Point72", "point72.com");
  assert.match(url, /domain=point72\.com/);
  assert.match(url, /company=Point72/);
});

test("logoUrl falls back to name-only when domain missing", () => {
  const url = logoUrl("Stripe", null);
  assert.doesNotMatch(url, /domain=/);
});

test("logoCacheKey keys by domain when available", () => {
  assert.equal(logoCacheKey("Point72", "point72.com"), "domain:point72.com");
});
