import assert from "node:assert/strict";
import test from "node:test";
import { enrichAlertPostingCandidate } from "../../lib/alerts/enrich-posting.ts";
import {
  DEFAULT_ALERT_FILTERS,
  mergeAlertFilters,
  parseAlertFilterOverride,
  parseAlertFiltersView,
  postingMatchesAlertFilters,
} from "../../lib/alerts/filters.ts";

const basePosting = enrichAlertPostingCandidate({
  postingId: "p1",
  companyId: "c1",
  companySlug: "acme",
  industrySlug: "tech",
  companyName: "Acme",
  roleName: "SWE Intern",
  postingUrl: "https://example.com/1",
  season: "Fall",
  location: "San Francisco, CA",
  firstSeenAt: "2026-06-01T12:00:00.000Z",
});

test("postingMatchesAlertFilters allows all by default", () => {
  assert.equal(postingMatchesAlertFilters(basePosting, DEFAULT_ALERT_FILTERS), true);
});

test("postingMatchesAlertFilters filters by season", () => {
  assert.equal(
    postingMatchesAlertFilters(basePosting, {
      ...DEFAULT_ALERT_FILTERS,
      seasons: ["Summer"],
    }),
    false,
  );
  assert.equal(
    postingMatchesAlertFilters(basePosting, {
      ...DEFAULT_ALERT_FILTERS,
      seasons: ["Fall"],
    }),
    true,
  );
});

test("postingMatchesAlertFilters filters by country", () => {
  assert.equal(
    postingMatchesAlertFilters(basePosting, {
      ...DEFAULT_ALERT_FILTERS,
      countries: ["US"],
    }),
    true,
  );
  assert.equal(
    postingMatchesAlertFilters(basePosting, {
      ...DEFAULT_ALERT_FILTERS,
      countries: ["GB"],
    }),
    false,
  );
});

test("postingMatchesAlertFilters excludes remote-only when includeRemote is false", () => {
  const remoteOnly = enrichAlertPostingCandidate({
    ...basePosting,
    location: "Remote",
    season: "Summer",
  });
  assert.equal(remoteOnly.hasRemote, true);
  assert.equal(remoteOnly.countries.length, 0);
  assert.equal(
    postingMatchesAlertFilters(remoteOnly, {
      ...DEFAULT_ALERT_FILTERS,
      includeRemote: false,
    }),
    false,
  );
});

test("postingMatchesAlertFilters keeps remote US role when countries include US", () => {
  const remoteUs = enrichAlertPostingCandidate({
    ...basePosting,
    location: "Remote, US",
    season: "Summer",
  });
  assert.equal(
    postingMatchesAlertFilters(remoteUs, {
      ...DEFAULT_ALERT_FILTERS,
      countries: ["US"],
      includeRemote: false,
    }),
    true,
  );
});

test("mergeAlertFilters applies partial override", () => {
  const global = {
    seasons: ["Fall"],
    countries: ["US"],
    includeRemote: true,
  } satisfies import("../../lib/alerts/filters.ts").AlertFilters;
  const effective = mergeAlertFilters(global, { seasons: ["Summer"] });
  assert.deepEqual(effective.seasons, ["Summer"]);
  assert.deepEqual(effective.countries, ["US"]);
});

test("parseAlertFiltersView normalizes valid serialized filter input", () => {
  const parsed = parseAlertFiltersView({
    seasons: ["Fall", "Fall"],
    countries: ["us", "GB"],
    includeRemote: false,
  });

  assert.deepEqual(parsed, {
    value: {
      seasons: ["Fall"],
      countries: ["US", "GB"],
      includeRemote: false,
    },
  });
});

test("parseAlertFiltersView rejects forged filter values", () => {
  assert.deepEqual(parseAlertFiltersView({ seasons: ["Bad"], countries: [], includeRemote: true }), {
    error: "Invalid season filter.",
  });
  assert.deepEqual(parseAlertFiltersView({ seasons: [], countries: ["ZZ"], includeRemote: true }), {
    error: "Invalid country filter.",
  });
  assert.deepEqual(parseAlertFiltersView({ seasons: [], countries: [], includeRemote: "yes" }), {
    error: "Invalid remote filter.",
  });
});

test("parseAlertFilterOverride allows partial overrides and rejects invalid values", () => {
  assert.deepEqual(parseAlertFilterOverride({ countries: ["ca"], includeRemote: false }), {
    value: { countries: ["CA"], includeRemote: false },
  });
  assert.deepEqual(parseAlertFilterOverride(null), { value: null });
  assert.deepEqual(parseAlertFilterOverride({ includeRemote: null }), {
    error: "Invalid remote filter.",
  });
});
