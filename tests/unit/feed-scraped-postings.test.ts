import assert from "node:assert/strict";
import test from "node:test";
import {
  mapScrapedRowToFeedPosting,
  type ScrapedPostingFeedRow,
} from "../../lib/feed/scraped-postings.ts";

function row(overrides: Partial<ScrapedPostingFeedRow> = {}): ScrapedPostingFeedRow {
  return {
    id: "posting-1",
    company_name: "Lockheed Martin",
    role_name: "EMI/EMC/E3 Engineer",
    posting_url: "https://example.com/jobs/1",
    season: null,
    location: "Colorado, United States · Florida, Cuba · Texas, United States",
    raw_location: "Colorado, Florida, Texas",
    location_places: [
      { city: null, region: "CO", remote: false, country_code: "US" },
      { city: "Florida", region: null, remote: false, country_code: "CU" },
      { city: null, region: "TX", remote: false, country_code: "US" },
    ],
    countries: ["CU", "US"],
    first_seen_at: "2026-06-10T05:29:01.034Z",
    last_seen_at: "2026-06-10T05:29:01.034Z",
    updated_at: "2026-06-10T05:29:01.034Z",
    companies: {
      slug: "lockheed-martin",
      website_url: "https://www.lockheedmartin.com",
      logo_asset_key: "lockheed-martin",
    },
    ...overrides,
  };
}

test("mapScrapedRowToFeedPosting displays only enabled-country locations", () => {
  const posting = mapScrapedRowToFeedPosting(row(), { enabledCountryCodes: ["US"] });

  assert.ok(posting);
  assert.deepEqual(posting.locations, ["Colorado, United States", "Texas, United States"]);
  assert.deepEqual(posting.countries, ["US"]);
  assert.equal(posting.canonicalPlaces.length, 2);
});

