import assert from "node:assert/strict";
import test from "node:test";

import { ashbyRoleHasApiUpdatedAt, parseAshbyJobs, parseAshbyPostingPageUpdatedAt } from "@/lib/scraping/adapters/ashby";
import { parseAshbyDescriptor } from "@/lib/scraping/structured-place";
import type { CompanySourceConfig } from "@/lib/scraping/types";
import { normalizeCountryCode } from "@/lib/geo/countries";

const SOURCE: CompanySourceConfig = {
  id: "source-uuid",
  companyId: "company-uuid",
  companySlug: "ramp",
  companyName: "Ramp",
  sourceType: "ashby",
  adapterKey: "ashby",
  sourceUrl: "https://jobs.ashbyhq.com/ramp",
  boardToken: "ramp",
};

test("parseAshbyDescriptor resolves Snowflake-style country-city tokens", () => {
  assert.deepEqual(parseAshbyDescriptor("CH-Zurich-Observe"), {
    city: "Zurich",
    countryCode: "CH",
    remote: false,
  });
  assert.deepEqual(parseAshbyDescriptor("US-DC-Remote"), {
    region: "DC",
    countryCode: "US",
    remote: true,
  });
});

test("parseAshbyJobs maps Snowflake Zurich intern to CH for country allowlist", () => {
  const parsed = parseAshbyJobs(
    [
      {
        id: "26a0ae52-97a6-4a46-9216-3c382570d89b",
        title: "Software Engineer Intern - Zurich (2026)",
        jobUrl: "https://jobs.ashbyhq.com/snowflake/26a0ae52-97a6-4a46-9216-3c382570d89b",
        descriptionPlain: "Software engineering internship",
        employmentType: "Intern",
        location: "CH-Zurich-Observe",
        isListed: true,
      },
    ],
    { ...SOURCE, companySlug: "snowflake", companyName: "Snowflake", boardToken: "snowflake" },
  );

  assert.equal(parsed.roles.length, 1);
  assert.deepEqual(parsed.roles[0].countries, ["CH"]);
  assert.equal(parsed.roles[0].location, "Zurich, Switzerland");
});

test("parseAshbyJobs rejects non-engineering Snowflake internships", () => {
  const parsed = parseAshbyJobs(
    [
      {
        id: "cade83ae-9727-4497-8e73-8a310a8b6a85",
        title: "Government Affairs Intern",
        jobUrl: "https://jobs.ashbyhq.com/snowflake/cade83ae-9727-4497-8e73-8a310a8b6a85",
        descriptionPlain: "Support government affairs programs for Snowflake.",
        employmentType: "Intern",
        location: "US-DC-Remote",
        workplaceType: "OnSite",
        isListed: true,
      },
    ],
    { ...SOURCE, companySlug: "snowflake", companyName: "Snowflake", boardToken: "snowflake" },
  );

  assert.equal(parsed.roles.length, 0);
  assert.equal(parsed.stats.rejected[0]?.reason, "non_engineering_role");
});

test("parseAshbyJobs preserves publishedAt in ATS dates", () => {
  const parsed = parseAshbyJobs(
    [
      {
        id: "67fadb77-43d8-4449-954b-d4cf2c6d3b8b",
        title: "Software Engineer Internship, Android ",
        jobUrl: "https://jobs.ashbyhq.com/ramp/67fadb77-43d8-4449-954b-d4cf2c6d3b8b",
        descriptionPlain: "Fall Program (August/September 2026 - December 2026)",
        employmentType: "Intern",
        location: "New York, NY",
        publishedAt: "2025-08-07T20:49:38.961+00:00",
        isListed: true,
      },
    ],
    SOURCE,
  );

  assert.equal(parsed.roles.length, 1);
  assert.equal(parsed.roles[0].atsDates?.publishedAt, "2025-08-07T20:49:38.961+00:00");
});

test("parseAshbyJobs preserves updatedAt in ATS dates", () => {
  const parsed = parseAshbyJobs(
    [
      {
        id: "67fadb77-43d8-4449-954b-d4cf2c6d3b8b",
        title: "Software Engineer Internship, Android ",
        jobUrl: "https://jobs.ashbyhq.com/ramp/67fadb77-43d8-4449-954b-d4cf2c6d3b8b",
        descriptionPlain: "Fall Program (August/September 2026 - December 2026)",
        employmentType: "Intern",
        location: "New York, NY",
        publishedAt: "2025-08-07T20:49:38.961+00:00",
        updatedAt: "2026-06-04T16:57:38.597Z",
        isListed: true,
      },
    ],
    SOURCE,
  );

  assert.equal(parsed.roles.length, 1);
  assert.equal(parsed.roles[0].atsDates?.updatedAt, "2026-06-04T16:57:38.597Z");
  assert.equal(ashbyRoleHasApiUpdatedAt(parsed.roles[0]), true);
});

test("ashbyRoleHasApiUpdatedAt is false when updatedAt is missing", () => {
  assert.equal(ashbyRoleHasApiUpdatedAt({ atsDates: { updatedAt: null } }), false);
});

test("parseAshbyPostingPageUpdatedAt reads updatedAt from embedded page data", () => {
  const html = `
    <script>
      window.__appData = {"posting":{"id":"67fadb77-43d8-4449-954b-d4cf2c6d3b8b","updatedAt":"2026-06-04T16:57:38.597Z"}};
    </script>
  `;

  assert.equal(parseAshbyPostingPageUpdatedAt(html), "2026-06-04T16:57:38.597Z");
});

test("normalizeCountryCode resolves ATS country names to ISO alpha-2", () => {
  assert.equal(normalizeCountryCode("Canada"), "CA");
  assert.equal(normalizeCountryCode("United Kingdom"), "GB");
});

test("parseAshbyJobs keeps secondary postal locations and normalizes Canada", () => {
  const parsed = parseAshbyJobs(
    [
      {
        id: "cohere-se-intern",
        title: "Software Engineer Intern (Fall / Winter 2026)",
        jobUrl: "https://jobs.ashbyhq.com/cohere/cohere-se-intern",
        descriptionPlain: "Internship program",
        employmentType: "Intern",
        location: "Canada",
        address: {
          postalAddress: {
            addressCountry: "Canada",
          },
        },
        secondaryLocations: [
          {
            location: "United States",
            address: {
              postalAddress: {
                addressLocality: "San Francisco",
                addressRegion: "California",
                addressCountry: "United States",
              },
            },
          },
        ],
        isListed: true,
      },
    ],
    { ...SOURCE, companySlug: "cohere", companyName: "Cohere", boardToken: "cohere" },
  );

  assert.equal(parsed.roles.length, 1);
  assert.deepEqual(parsed.roles[0].countries, ["CA", "US"]);
});
