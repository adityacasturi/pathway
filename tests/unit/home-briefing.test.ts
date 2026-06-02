import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHomeBriefing,
  buildHotCompanies,
  buildIndustrySpotlight,
  buildMarketPulse,
  buildMarketWeekSummary,
  buildSeasonSpotlight,
  buildStarredPostings,
  parseCompanySlug,
  HOME_ACTIVITY_WINDOW_SECONDS,
  HOME_NEW_WINDOW_SECONDS,
} from "../../lib/home/briefing.ts";
import type { FeedPosting } from "../../lib/feed/types.ts";

const NOW = 1_700_000_000;

function samplePosting(overrides: Partial<FeedPosting> = {}): FeedPosting {
  return {
    id: "posting-1",
    interactionIds: ["posting-1", "row-1"],
    sourceId: "company:acme",
    company: "Acme Corp",
    companyWebsiteUrl: null,
    companyLogoAssetKey: null,
    title: "Software Engineer Intern",
    url: "https://example.com/jobs/1",
    locations: ["San Francisco, CA"],
    countries: ["US"],
    hasRemote: false,
    season: "Summer",
    datePosted: NOW - 3600,
    pathwayNewUnix: NOW - 3600,
    postedDisplay: { kind: "posted", unixSeconds: NOW - 3600, confidence: "high" },
    dateUpdated: NOW - 3600,
    ...overrides,
  };
}

test("parseCompanySlug reads company source ids", () => {
  assert.equal(parseCompanySlug("company:stripe"), "stripe");
  assert.equal(parseCompanySlug("other:stripe"), null);
});

test("buildMarketPulse counts open, remote, and yesterday totals", () => {
  const postings = [
    samplePosting({ id: "a", pathwayNewUnix: NOW - 1000, hasRemote: true }),
    samplePosting({ id: "b", pathwayNewUnix: NOW - HOME_NEW_WINDOW_SECONDS - 1 }),
    samplePosting({ id: "c", pathwayNewUnix: NOW - 2000, season: "Fall" }),
  ];

  const pulse = buildMarketPulse(postings, NOW);
  assert.equal(pulse.sinceYesterday, 2);
  assert.equal(pulse.openTotal, 3);
  assert.equal(pulse.remoteOpen, 1);
  assert.equal(pulse.dominantSeason, "Summer");
});

test("buildMarketWeekSummary uses posted date within seven days", () => {
  const postings = [
    samplePosting({
      id: "recent",
      datePosted: NOW - 1000,
      hasRemote: true,
      locations: ["New York, NY"],
    }),
    samplePosting({
      id: "old",
      datePosted: NOW - HOME_ACTIVITY_WINDOW_SECONDS - 1,
      pathwayNewUnix: NOW - 1000,
    }),
  ];

  const week = buildMarketWeekSummary(postings, NOW);
  assert.equal(week.postedCount, 1);
  assert.equal(week.remoteCount, 1);
  assert.equal(week.activeCompanyCount, 1);
  assert.equal(week.topLocation?.label, "New York");
});

test("buildHotCompanies filters by datePosted not pathwayNewUnix", () => {
  const postings = [
    samplePosting({
      sourceId: "company:meta",
      company: "Meta",
      datePosted: NOW - HOME_ACTIVITY_WINDOW_SECONDS - 1,
      pathwayNewUnix: NOW - 1000,
    }),
    samplePosting({
      id: "p2",
      sourceId: "company:stripe",
      company: "Stripe",
      datePosted: NOW - 1000,
    }),
  ];

  const hot = buildHotCompanies(postings, { nowUnix: NOW });
  assert.equal(hot.length, 1);
  assert.equal(hot[0]?.slug, "stripe");
});

test("buildHotCompanies carries companyWebsiteUrl for logos", () => {
  const postings = [
    samplePosting({
      sourceId: "company:stripe",
      company: "Stripe",
      companyWebsiteUrl: "https://stripe.com",
    }),
  ];

  const hot = buildHotCompanies(postings, { nowUnix: NOW });
  assert.equal(hot[0]?.websiteUrl, "https://stripe.com");
});

test("buildHotCompanies excludes starred slugs and sorts by count", () => {
  const postings = [
    samplePosting({ sourceId: "company:stripe", company: "Stripe" }),
    samplePosting({ id: "p2", sourceId: "company:stripe", company: "Stripe" }),
    samplePosting({ id: "p3", sourceId: "company:meta", company: "Meta" }),
  ];

  const hot = buildHotCompanies(postings, {
    nowUnix: NOW,
    excludeSlugs: new Set(["stripe"]),
  });

  assert.equal(hot.length, 1);
  assert.equal(hot[0]?.slug, "meta");
  assert.equal(hot[0]?.newCount, 1);
});

test("buildIndustrySpotlight aggregates by company industry using datePosted", () => {
  const postings = [
    samplePosting({ sourceId: "company:stripe", company: "Stripe" }),
    samplePosting({ id: "p2", sourceId: "company:two-sigma", company: "Two Sigma" }),
    samplePosting({
      id: "p-old",
      sourceId: "company:meta",
      company: "Meta",
      datePosted: NOW - HOME_ACTIVITY_WINDOW_SECONDS - 1,
    }),
  ];

  const spotlight = buildIndustrySpotlight(
    postings,
    new Map([
      ["stripe", { industrySlug: "big-tech", industryLabel: "Big Tech" }],
      ["meta", { industrySlug: "big-tech", industryLabel: "Big Tech" }],
      ["two-sigma", { industrySlug: "quant", industryLabel: "Quant" }],
    ]),
    { nowUnix: NOW },
  );

  assert.equal(spotlight[0]?.industrySlug, "big-tech");
  assert.equal(spotlight[0]?.newCount, 1);
  assert.equal(spotlight[1]?.industrySlug, "quant");
});

test("buildSeasonSpotlight counts seasons from postings in the last week", () => {
  const postings = [
    samplePosting({ season: "Summer" }),
    samplePosting({ id: "p2", season: "Summer" }),
    samplePosting({ id: "p3", season: "Fall" }),
    samplePosting({
      id: "old",
      season: "Winter",
      datePosted: NOW - HOME_ACTIVITY_WINDOW_SECONDS - 1,
    }),
  ];

  const seasons = buildSeasonSpotlight(postings, { nowUnix: NOW });
  assert.equal(seasons[0]?.season, "Summer");
  assert.equal(seasons[0]?.newCount, 2);
  assert.equal(seasons[1]?.season, "Fall");
});

test("buildStarredPostings only includes starred companies", () => {
  const feed = [
    samplePosting({
      id: "starred",
      sourceId: "company:google",
      company: "Google",
      pathwayNewUnix: NOW - 1000,
    }),
    samplePosting({
      id: "other",
      sourceId: "company:meta",
      company: "Meta",
      pathwayNewUnix: NOW - 500,
    }),
  ];

  const alerts = buildStarredPostings(feed, {
    nowUnix: NOW,
    favoriteSlugs: new Set(["google"]),
    dismissedIds: new Set(),
    trackedUrls: new Set(),
  });

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]?.posting.id, "starred");
});

test("buildStarredPostings includes older open roles from starred companies", () => {
  const feed = [
    samplePosting({
      id: "older",
      sourceId: "company:google",
      company: "Google",
      datePosted: NOW - HOME_ACTIVITY_WINDOW_SECONDS * 4,
      pathwayNewUnix: NOW - HOME_ACTIVITY_WINDOW_SECONDS * 4,
    }),
  ];

  const alerts = buildStarredPostings(feed, {
    nowUnix: NOW,
    favoriteSlugs: new Set(["google"]),
    dismissedIds: new Set(),
    trackedUrls: new Set(),
  });

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]?.isNew, false);
});

test("buildStarredPostings skips dismissed and tracked postings", () => {
  const feed = [
    samplePosting({
      id: "dismissed",
      interactionIds: ["dismissed", "row-dismissed"],
      sourceId: "company:stripe",
      company: "Stripe",
    }),
    samplePosting({
      id: "tracked",
      sourceId: "company:google",
      company: "Google",
      url: "https://example.com/jobs/tracked",
    }),
    samplePosting({
      id: "open",
      sourceId: "company:meta",
      company: "Meta",
    }),
  ];

  const alerts = buildStarredPostings(feed, {
    nowUnix: NOW,
    favoriteSlugs: new Set(["stripe", "google", "meta"]),
    dismissedIds: new Set(["dismissed"]),
    trackedUrls: new Set(["https://example.com/jobs/tracked"]),
  });

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]?.posting.id, "open");
});

test("buildHomeBriefing composes briefing sections", () => {
  const posting = samplePosting();
  const briefing = buildHomeBriefing({
    postings: [posting],
    nowUnix: NOW,
    favoriteSlugs: new Set(["acme"]),
    dismissedIds: new Set(),
    trackedUrls: new Set(),
  });

  assert.equal(briefing.starredPostings.length, 1);
  assert.equal(briefing.marketPulse.openTotal, 1);
  assert.equal(briefing.marketWeek.postedCount, 1);
});
