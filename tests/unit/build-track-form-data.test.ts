import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTrackApplicationFormData,
  buildTrackApplicationFormDataFromScraped,
  feedSeasonToApplicationSeason,
} from "../../lib/feed/build-track-form-data.ts";
import type { FeedPosting } from "../../lib/feed/types.ts";

test("feedSeasonToApplicationSeason maps valid application seasons", () => {
  assert.equal(feedSeasonToApplicationSeason("Summer"), "Summer");
  assert.equal(feedSeasonToApplicationSeason("Fall"), "Fall");
  assert.equal(feedSeasonToApplicationSeason("Spring"), "Spring");
  assert.equal(feedSeasonToApplicationSeason("Winter"), "Winter");
});

test("buildTrackApplicationFormDataFromScraped sets core fields", () => {
  const formData = buildTrackApplicationFormDataFromScraped(
    {
      roleName: "SWE Intern",
      postingUrl: "https://example.com/job",
      season: "Summer",
      location: "Remote",
    },
    "Acme",
  );

  assert.equal(formData.get("company"), "Acme");
  assert.equal(formData.get("role"), "SWE Intern");
  assert.equal(formData.get("posting_url"), "https://example.com/job");
  assert.equal(formData.get("location"), "Remote");
  assert.equal(formData.get("season"), "Summer");
  assert.match(String(formData.get("date_applied")), /^\d{4}-\d{2}-\d{2}$/);
});

test("buildTrackApplicationFormData joins feed posting locations", () => {
  const posting: FeedPosting = {
    id: "job_1",
    interactionIds: [],
    sourceId: "source-1",
    company: "Acme",
    companyWebsiteUrl: "https://acme.com",
    companyLogoAssetKey: null,
    title: "SWE Intern",
    url: "https://example.com/job",
    locations: ["NYC", "Remote"],
    canonicalPlaces: [],
    countries: ["US"],
    hasRemote: true,
    season: "Fall",
    datePosted: 1_700_000_000,
    pathwayNewUnix: 1_700_000_000,
    postedDisplay: {
      kind: "added",
      unixSeconds: 1_700_000_000,
    },
    dateUpdated: 1_700_000_000,
  };

  const formData = buildTrackApplicationFormData(posting);
  assert.equal(formData.get("location"), "NYC · Remote");
  assert.equal(formData.get("season"), "Fall");
});
