import assert from "node:assert/strict";
import test from "node:test";
import { buildRoleParseResult, dedupeScrapeRoles } from "../../lib/scraping/role-parse-result.ts";
import { atsPublishDate } from "../../lib/scraping/posted-date.ts";
import type { ScrapedRole } from "../../lib/scraping/types.ts";

function role(url: string, title = "SWE Intern"): ScrapedRole {
  return {
    postingUrl: url,
    roleName: title,
    companyName: "Acme",
    location: "Remote US",
    season: "Summer",
    datePosted: "2026-01-01",
    dates: atsPublishDate("2026-01-01"),
  };
}

test("dedupeScrapeRoles keeps the last role per posting URL", () => {
  const deduped = dedupeScrapeRoles([
    role("https://example.com/a", "First"),
    role("https://example.com/a", "Second"),
    role("https://example.com/b"),
  ]);
  assert.equal(deduped.length, 2);
  assert.equal(deduped.find((r) => r.postingUrl.endsWith("/a"))?.roleName, "Second");
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
