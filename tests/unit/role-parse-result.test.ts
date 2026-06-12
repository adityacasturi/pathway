import assert from "node:assert/strict";
import test from "node:test";
import { buildRoleParseResult, dedupeScrapeRoles } from "../../lib/scraping/role-parse-result.ts";
import { canonicalizePostingUrl } from "../../lib/scraping/posting-url.ts";
import type { ScrapedRole } from "../../lib/scraping/types.ts";

function role(url: string, title = "SWE Intern"): ScrapedRole {
  return {
    postingUrl: url,
    roleName: title,
    companyName: "Acme",
    roleType: "internship",
    season: "Summer",
    location: "Remote, United States",
    places: [{ city: null, region: null, countryCode: "US", remote: true }],
    rawLocation: "Remote US",
    locationConfidence: 72,
    countries: ["US"],
  };
}

test("dedupeScrapeRoles keeps the last role per canonical posting URL", () => {
  const deduped = dedupeScrapeRoles([
    role("https://example.com/a", "First"),
    role("https://example.com/a?utm_source=feed", "Second"),
    role("https://example.com/b"),
  ]);
  assert.equal(deduped.length, 2);
  assert.equal(deduped.find((r) => r.postingUrl.includes("/a"))?.roleName, "Second");
});

test("buildRoleParseResult reports fetched, kept, and rejected stats", () => {
  const result = buildRoleParseResult(
    5,
    [role("https://example.com/1"), role("https://example.com/1")],
    [{ title: "PM Intern", reason: "non_engineering_role" }],
  );
  assert.equal(result.stats.fetched, 5);
  assert.equal(result.stats.kept, 1);
  assert.equal(result.stats.rejected.length, 1);
  assert.equal(result.roles.length, 1);
});

test("canonicalizePostingUrl strips tracking params, hash, and trailing slash", () => {
  assert.equal(
    canonicalizePostingUrl("https://example.com/jobs/1/?utm_source=x&gh_src=abc#apply"),
    "https://example.com/jobs/1",
  );
  assert.equal(
    canonicalizePostingUrl("https://example.com/jobs/1?lever-origin=applied"),
    "https://example.com/jobs/1",
  );
  // Meaningful query params survive.
  assert.equal(
    canonicalizePostingUrl("https://example.com/jobs?id=42"),
    "https://example.com/jobs?id=42",
  );
  // Non-URLs are returned trimmed, never thrown on.
  assert.equal(canonicalizePostingUrl("  not a url  "), "not a url");
});
