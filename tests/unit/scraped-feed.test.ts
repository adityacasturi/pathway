import assert from "node:assert/strict";
import test from "node:test";
import { stablePostingId } from "../../lib/feed/ids.ts";
import {
  mapScrapedRowToFeedPosting,
  type ScrapedPostingFeedRow,
} from "../../lib/feed/scraped-postings.ts";

function sampleRow(overrides: Partial<ScrapedPostingFeedRow> = {}): ScrapedPostingFeedRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    company_name: "Acme Corp",
    role_name: "Software Engineer Intern",
    posting_url: "https://boards.greenhouse.io/acme/jobs/123?utm=1",
    season: "Summer",
    location: "San Francisco, CA",
    date_posted: "2026-04-01T12:00:00.000Z",
    date_posted_source: "ats_publish",
    date_posted_confidence: "high",
    first_seen_at: "2026-04-02T00:00:00.000Z",
    last_seen_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    companies: { slug: "acme", website_url: "https://www.acme.com", logo_asset_key: "acme" },
    ...overrides,
  };
}

test("mapScrapedRowToFeedPosting maps fields and stable URL id", () => {
  const posting = mapScrapedRowToFeedPosting(sampleRow());
  assert.ok(posting);
  assert.equal(posting.company, "Acme Corp");
  assert.equal(posting.companyWebsiteUrl, "https://www.acme.com");
  assert.equal(posting.title, "Software Engineer Intern");
  assert.equal(posting.season, "Summer");
  assert.deepEqual(posting.locations, ["San Francisco, CA"]);
  assert.equal(posting.sourceId, "company:acme");
  assert.equal(posting.id, stablePostingId("https://boards.greenhouse.io/acme/jobs/123?utm=1"));
  assert.ok(posting.interactionIds.includes(posting.id));
  assert.ok(posting.interactionIds.includes("00000000-0000-4000-8000-000000000001"));
  assert.equal(posting.datePosted, Math.floor(Date.parse("2026-04-01T12:00:00.000Z") / 1000));
  assert.equal(posting.pathwayNewUnix, Math.floor(Date.parse("2026-04-02T00:00:00.000Z") / 1000));
  assert.equal(posting.postedDisplay.kind, "posted");
});

test("stablePostingId ignores www and trailing slash differences", () => {
  const a = stablePostingId("https://www.example.com/jobs/1/");
  const b = stablePostingId("https://example.com/jobs/1");
  assert.equal(a, b);
});

test("mapScrapedRowToFeedPosting accepts Spring and Winter seasons", () => {
  assert.equal(mapScrapedRowToFeedPosting(sampleRow({ season: "Spring" }))?.season, "Spring");
  assert.equal(mapScrapedRowToFeedPosting(sampleRow({ season: "Winter" }))?.season, "Winter");
});

test("mapScrapedRowToFeedPosting rejects invalid season", () => {
  assert.equal(mapScrapedRowToFeedPosting(sampleRow({ season: "Co-op" })), null);
});

test("mapScrapedRowToFeedPosting rejects rows without a US location", () => {
  assert.equal(mapScrapedRowToFeedPosting(sampleRow({ location: null })), null);
});
