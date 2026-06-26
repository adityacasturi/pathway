import assert from "node:assert/strict";
import test from "node:test";
import { selectLandingOpeningPreview } from "../../lib/landing/openings-preview.ts";
import type { FeedPosting } from "../../lib/feed/types.ts";

function posting(id: string, datePosted: number): FeedPosting {
  return {
    id,
    interactionIds: [id],
    sourceId: `company:${id}`,
    company: id,
    companyWebsiteUrl: null,
    companyLogoAssetKey: null,
    title: `${id} internship`,
    url: `https://example.com/${id}`,
    locations: [],
    canonicalPlaces: [],
    countries: [],
    hasRemote: false,
    season: null,
    datePosted,
    postedDisplay: { kind: "posted", unixSeconds: datePosted },
    dateUpdated: datePosted,
  };
}

test("selectLandingOpeningPreview keeps only postings from the last 7 days", () => {
  const now = Math.floor(Date.parse("2026-06-21T12:00:00.000Z") / 1000);
  const day = 86_400;

  const preview = selectLandingOpeningPreview(
    [
      posting("today", now),
      posting("boundary", now - 7 * day),
      posting("older", now - 8 * day),
    ],
    { nowUnix: now, limit: 10 },
  );

  assert.deepEqual(
    preview.map((item) => item.id),
    ["today", "boundary"],
  );
});

test("selectLandingOpeningPreview sorts newest first and limits displayed rows", () => {
  const now = Math.floor(Date.parse("2026-06-21T12:00:00.000Z") / 1000);

  const preview = selectLandingOpeningPreview(
    [posting("older", now - 10), posting("newer", now - 5), posting("newest", now)],
    { nowUnix: now, limit: 2 },
  );

  assert.deepEqual(
    preview.map((item) => item.id),
    ["newest", "newer"],
  );
}
);
