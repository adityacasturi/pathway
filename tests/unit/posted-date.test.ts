import assert from "node:assert/strict";
import test from "node:test";
import {
  atsModifiedOnly,
  atsPublishDate,
  greenhouseRoleDates,
  mergeScrapedPostingDates,
  relativeParseDate,
  sitemapScrapedDates,
} from "../../lib/scraping/posted-date.ts";

const NOW = new Date("2026-05-30T12:00:00.000Z");
const FIRST_SEEN = "2026-05-01T00:00:00.000Z";

test("merge preserves existing publish date when incoming is null", () => {
  const merged = mergeScrapedPostingDates(
    {
      date_posted: "2026-04-01T00:00:00.000Z",
      date_modified: null,
      date_posted_source: "ats_publish",
      date_posted_confidence: "high",
      date_posted_raw: null,
    },
    atsPublishDate(null),
    FIRST_SEEN,
    NOW,
  );
  assert.equal(merged.date_posted, "2026-04-01T00:00:00.000Z");
  assert.equal(merged.date_posted_source, "ats_publish");
});

test("merge takes earliest publish-class date", () => {
  const merged = mergeScrapedPostingDates(
    {
      date_posted: "2026-05-20T00:00:00.000Z",
      date_modified: null,
      date_posted_source: "ats_publish",
      date_posted_confidence: "high",
      date_posted_raw: null,
    },
    atsPublishDate("2026-04-10T00:00:00.000Z"),
    FIRST_SEEN,
    NOW,
  );
  assert.equal(merged.date_posted, "2026-04-10T00:00:00.000Z");
});

test("merge does not move publish date forward", () => {
  const merged = mergeScrapedPostingDates(
    {
      date_posted: "2026-04-01T00:00:00.000Z",
      date_modified: null,
      date_posted_source: "ats_publish",
      date_posted_confidence: "high",
      date_posted_raw: null,
    },
    atsPublishDate("2026-05-25T00:00:00.000Z"),
    FIRST_SEEN,
    NOW,
  );
  assert.equal(merged.date_posted, "2026-04-01T00:00:00.000Z");
});

test("ats_modified only updates date_modified", () => {
  const merged = mergeScrapedPostingDates(
    {
      date_posted: "2026-04-01T00:00:00.000Z",
      date_modified: null,
      date_posted_source: "ats_publish",
      date_posted_confidence: "high",
      date_posted_raw: null,
    },
    atsModifiedOnly("2026-05-29T00:00:00.000Z"),
    FIRST_SEEN,
    NOW,
  );
  assert.equal(merged.date_posted, "2026-04-01T00:00:00.000Z");
  assert.equal(merged.date_modified, "2026-05-29T00:00:00.000Z");
});

test("sitemap incoming does not replace ats_publish", () => {
  const merged = mergeScrapedPostingDates(
    {
      date_posted: "2026-04-01T00:00:00.000Z",
      date_modified: null,
      date_posted_source: "ats_publish",
      date_posted_confidence: "high",
      date_posted_raw: null,
    },
    sitemapScrapedDates("2026-05-30T10:00:00.000Z"),
    FIRST_SEEN,
    NOW,
  );
  assert.equal(merged.date_posted, "2026-04-01T00:00:00.000Z");
  assert.equal(merged.date_posted_source, "ats_publish");
});

test("greenhouseRoleDates ignores non-string metadata values without throwing", () => {
  const dates = greenhouseRoleDates({
    updated_at: "2026-05-29T12:00:00.000Z",
    metadata: [
      { name: "Published", value: { nested: true } },
      { name: "Employment Type", value: 12345 },
    ],
  });
  assert.equal(dates.source, "ats_modified");
  assert.equal(dates.published, null);
  assert.ok(dates.modified);
});

test("greenhouseRoleDates uses top-level first_published", () => {
  const dates = greenhouseRoleDates({
    first_published: "2025-05-30T18:30:33-04:00",
    updated_at: "2026-05-21T15:34:18-04:00",
    metadata: [{ name: "Employment Type", value: "Internship_non-exempt" }],
  });
  assert.equal(dates.source, "ats_publish");
  assert.equal(dates.confidence, "high");
  assert.equal(dates.published, "2025-05-30T22:30:33.000Z");
  assert.equal(dates.modified, "2026-05-21T19:34:18.000Z");
});

test("relative_parse is stored as publish with medium confidence", () => {
  const merged = mergeScrapedPostingDates(
    null,
    relativeParseDate("2026-05-20T00:00:00.000Z", "Posted 10 days ago"),
    FIRST_SEEN,
    NOW,
  );
  assert.equal(merged.date_posted_source, "relative_parse");
  assert.equal(merged.date_posted_confidence, "medium");
  assert.equal(merged.date_posted_raw, "Posted 10 days ago");
});
