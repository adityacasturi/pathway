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
    posted_at: "2026-06-10T05:29:01.034Z",
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

test("mapScrapedRowToFeedPosting scopes feed ids by company for shared apply URLs", () => {
  const sharedUrl = "https://careers.synopsys.com/job/sunnyvale/summer-2026-internship/44408/96806947728";
  const ansys = mapScrapedRowToFeedPosting(
    row({
      id: "ansys-row",
      posting_url: sharedUrl,
      companies: {
        slug: "ansys",
        website_url: "https://www.ansys.com",
        logo_asset_key: "ansys",
      },
    }),
  );
  const synopsys = mapScrapedRowToFeedPosting(
    row({
      id: "synopsys-row",
      posting_url: sharedUrl,
      companies: {
        slug: "synopsys",
        website_url: "https://www.synopsys.com",
        logo_asset_key: "synopsys",
      },
    }),
  );

  assert.ok(ansys);
  assert.ok(synopsys);
  assert.notEqual(ansys.id, synopsys.id);
  assert.equal(ansys.interactionIds[0], synopsys.interactionIds[0]);
  assert.equal(ansys.interactionIds[1], "ansys-row");
  assert.equal(synopsys.interactionIds[1], "synopsys-row");
});

test("mapScrapedRowToFeedPosting uses posted_at for republished roles", () => {
  const posting = mapScrapedRowToFeedPosting(
    row({
      role_name: "Summer 2027 Quantitative Research Internship",
      first_seen_at: "2024-08-15T21:28:38.000Z",
      posted_at: "2026-06-12T17:40:11.000Z",
    }),
  );

  assert.ok(posting);
  assert.equal(posting.datePosted, Math.floor(Date.parse("2026-06-12T17:40:11.000Z") / 1000));
  assert.deepEqual(posting.postedDisplay, {
    kind: "posted",
    unixSeconds: Math.floor(Date.parse("2026-06-12T17:40:11.000Z") / 1000),
  });
});
