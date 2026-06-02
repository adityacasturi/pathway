import assert from "node:assert/strict";
import test from "node:test";
import { atsPublishDate } from "../../lib/scraping/posted-date.ts";
import { buildScrapedPostingUpsertRows } from "../../lib/scraping/upsert.ts";

test("buildScrapedPostingUpsertRows preserves first_seen_at for existing postings", () => {
  const now = "2026-05-30T12:00:00.000Z";
  const existing = new Map([
    [
      "https://boards.example/jobs/1",
      {
        first_seen_at: "2026-01-01T00:00:00.000Z",
        dates: {
          date_posted: "2026-03-01T00:00:00.000Z",
          date_modified: null,
          date_posted_source: "ats_publish" as const,
          date_posted_confidence: "high" as const,
          date_posted_raw: null,
        },
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
        datePosted: null,
        dates: atsPublishDate("2026-05-29T00:00:00.000Z"),
      },
      {
        postingUrl: "https://boards.example/jobs/2",
        roleName: "Backend Intern",
        companyName: "Example",
        season: "Fall",
        location: "San Francisco, CA",
        datePosted: "2026-05-01T00:00:00.000Z",
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
  assert.equal(rows[0].date_posted, "2026-03-01T00:00:00.000Z");
  assert.equal(rows[0].season, "Summer");
  assert.equal(rows[1].first_seen_at, now);
  assert.equal(rows[1].date_posted, "2026-05-01T00:00:00.000Z");
  assert.equal(rows[1].season, "Fall");
});
