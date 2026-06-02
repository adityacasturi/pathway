import assert from "node:assert/strict";
import test from "node:test";
import type { FeedPosting } from "../../lib/feed/types.ts";
import { buildMarketStats } from "../../lib/stats/market.ts";

const NOW = 1_700_000_000;

function posting(overrides: Partial<FeedPosting> & Pick<FeedPosting, "id" | "sourceId">): FeedPosting {
  return {
    interactionIds: [],
    company: "Acme",
    companyWebsiteUrl: null,
    title: "SWE Intern",
    url: `https://example.com/${overrides.id}`,
    locations: ["San Francisco, CA"],
    countries: ["US"],
    hasRemote: false,
    season: "Summer",
    datePosted: NOW - 86_400,
    pathwayNewUnix: NOW - 3_600,
    postedDisplay: { kind: "posted", unixSeconds: NOW - 86_400, confidence: "high" },
    dateUpdated: NOW,
    ...overrides,
  };
}

test("buildMarketStats counts catalog companies and hiring companies", () => {
  const postings = [
    posting({ id: "a", sourceId: "company:acme" }),
    posting({ id: "b", sourceId: "company:acme" }),
    posting({ id: "c", sourceId: "company:beta" }),
  ];

  const stats = buildMarketStats({
    postings,
    industryBySlug: new Map(),
    discoverCompanyCount: 120,
    nowUnix: NOW,
  });

  assert.equal(stats.catalog.discoverCompanies, 120);
  assert.equal(stats.catalog.companiesWithOpenRoles, 2);
  assert.equal(stats.pulse.openTotal, 3);
  assert.equal(stats.catalogHiringRate, 2);
  assert.equal(stats.avgOpenRolesPerCompany, 1.5);
});
