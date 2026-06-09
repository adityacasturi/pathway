import assert from "node:assert/strict";
import test from "node:test";
import { buildScrapedPostingUpsertRows, mapCompanySourceRow } from "../../lib/scraping/upsert.ts";

test("buildScrapedPostingUpsertRows preserves first_seen_at for existing rows", () => {
  const now = "2026-05-30T12:00:00.000Z";
  const existing = new Map([
    [
      "https://boards.example/jobs/1",
      {
        first_seen_at: "2026-01-01T00:00:00.000Z",
      },
    ],
  ]);

  const rows = buildScrapedPostingUpsertRows(
    [
      {
        postingUrl: "https://boards.example/jobs/1",
        roleName: "Software Engineer Intern",
        companyName: "Example",
        season: "Summer",
        location: "New York, NY",
      },
      {
        postingUrl: "https://boards.example/jobs/2",
        roleName: "Backend Intern",
        companyName: "Example",
        season: "Fall",
        location: "San Francisco, CA",
      },
    ],
    "company-uuid",
    "example",
    now,
    existing,
  );

  assert.equal(rows.length, 2);
  assert.equal(rows[0].first_seen_at, "2026-01-01T00:00:00.000Z");
  assert.equal(rows[0].last_seen_at, now);
  assert.equal(rows[0].status, "open");
  assert.equal(rows[0].season, "Summer");
  assert.equal(rows[1].first_seen_at, now);
  assert.equal(rows[1].last_seen_at, now);
  assert.equal(rows[1].season, "Fall");
});

test("buildScrapedPostingUpsertRows keeps US locations only in US-only product scope", () => {
  const now = "2026-05-30T12:00:00.000Z";

  const rows = buildScrapedPostingUpsertRows(
    [
      {
        postingUrl: "https://boards.example/jobs/multi",
        roleName: "Software Engineer Intern",
        companyName: "Example",
        season: "Summer",
        location: "New York, NY · London, United Kingdom",
      },
      {
        postingUrl: "https://boards.example/jobs/foreign",
        roleName: "Backend Intern",
        companyName: "Example",
        season: "Fall",
        location: "London, United Kingdom",
      },
      {
        postingUrl: "https://boards.example/jobs/unknown",
        roleName: "Frontend Intern",
        companyName: "Example",
        season: "Spring",
        location: "Remote",
      },
    ],
    "company-uuid",
    "example",
    now,
    new Map(),
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].posting_url, "https://boards.example/jobs/multi");
  assert.equal(rows[0].location, "New York City, NY, United States");
  assert.deepEqual(rows[0].countries, ["US"]);
  assert.deepEqual(rows[0].location_places, [
    {
      city: "New York City",
      region: "NY",
      country_code: "US",
      remote: false,
    },
  ]);
});

test("mapCompanySourceRow accepts current source types and rejects unknown values", () => {
  const baseRow = {
    id: "source-uuid",
    source_type: "x_corp",
    adapter_key: "x_corp",
    source_url: "https://boards.example/x",
    board_token: null,
    companies: {
      id: "company-uuid",
      slug: "x-corp",
      name: "X Corp",
    },
  };

  assert.equal(mapCompanySourceRow(baseRow)?.sourceType, "x_corp");
  assert.equal(mapCompanySourceRow({ ...baseRow, source_type: "not_a_real_source" }), null);
  assert.equal(mapCompanySourceRow({ ...baseRow, companies: null }), null);
});
