import assert from "node:assert/strict";
import test from "node:test";
import {
  collectRipplingStructuredPlaces,
  extractRipplingAlgoliaIndexName,
  parseRipplingAlgoliaHits,
  parseRipplingJobs,
} from "../../lib/scraping/adapters/rippling.ts";
import type { CompanySourceConfig } from "../../lib/scraping/types.ts";

const source: CompanySourceConfig = {
  id: "source-rippling",
  companyId: "company-rippling",
  companyName: "Rippling",
  companySlug: "rippling",
  sourceType: "rippling",
  adapterKey: "rippling",
  sourceUrl: "https://www.rippling.com/careers/open-roles",
  boardToken: "rippling",
  lastFetchedCount: null,
};

test("extractRipplingAlgoliaIndexName reads current careers page data", () => {
  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        data: {
          algoliaIndexName: "careers_en-US_production",
        },
      },
    },
  })}</script>`;

  assert.equal(extractRipplingAlgoliaIndexName(html), "careers_en-US_production");
});

test("parseRipplingAlgoliaHits merges duplicate job locations by jobId", () => {
  const jobs = parseRipplingAlgoliaHits([
    {
      jobId: "job-1",
      name: "Software Engineer Intern",
      url: "https://ats.rippling.com/rippling/jobs/job-1",
      departmentName: "Engineering",
      locationNames: ["San Francisco, CA"],
      locations: [{ name: "San Francisco, CA", countryCode: "US", workplaceType: "ON_SITE" }],
    },
    {
      jobId: "job-1",
      name: "Software Engineer Intern",
      url: "https://ats.rippling.com/rippling/jobs/job-1",
      departmentName: "Engineering",
      locationNames: ["Remote (United States)"],
      locations: [
        { name: "Remote (United States)", countryCode: "US", workplaceType: "REMOTE" },
      ],
    },
  ]);

  assert.equal(jobs.length, 1);
  assert.deepEqual(jobs[0]?.locationNames, ["San Francisco, CA", "Remote (United States)"]);
  assert.equal(jobs[0]?.locations?.length, 2);
});

test("collectRipplingStructuredPlaces uses locationNames when structured fields are absent", () => {
  const places = collectRipplingStructuredPlaces({
    id: "job-1",
    name: "Software Engineer Intern",
    url: "https://ats.rippling.com/rippling/jobs/job-1",
    locationNames: ["Remote (United States)"],
  });

  assert.deepEqual(places, [{ rawLabel: "Remote (United States)", remote: true }]);
});

test("parseRipplingJobs accepts current Algolia engineering internship hits", () => {
  const jobs = parseRipplingAlgoliaHits([
    {
      jobId: "job-1",
      name: "Software Engineer Intern",
      url: "https://ats.rippling.com/rippling/jobs/job-1",
      departmentName: "Engineering",
      locationNames: ["San Francisco, CA"],
    },
  ]);

  const result = parseRipplingJobs(jobs, source);

  assert.equal(result.stats.fetched, 1);
  assert.equal(result.roles.length, 1);
  assert.equal(result.roles[0]?.roleName, "Software Engineer Intern");
});
