import assert from "node:assert/strict";
import test from "node:test";
import {
  parseLockheedMartinJobs,
  parseLockheedJobsListings,
  parseLockheedJobsSearchHtml,
  resolveLockheedMartinPlatform,
  type BrassRingJobDetail,
  type LockheedJobsListing,
} from "../../lib/scraping/adapters/lockheed-martin.ts";
import type { CompanySourceConfig } from "../../lib/scraping/types.ts";

const source: CompanySourceConfig = {
  id: "source-lockheed",
  companyId: "company-lockheed",
  companyName: "Lockheed Martin",
  companySlug: "lockheed-martin",
  sourceType: "lockheed_martin",
  adapterKey: "lockheed_martin",
  sourceUrl:
    "https://sjobs.brassring.com/TGnewUI/Search/Home/Home?partnerid=25037&siteid=5010",
  boardToken: "25037:5010",
  lastFetchedCount: null,
};

const jobsSource: CompanySourceConfig = {
  ...source,
  adapterKey: "lockheed-martin-jobs",
  sourceUrl: "https://www.lockheedmartinjobs.com/search-jobs?k=intern&l=&listFilterMode=1",
  boardToken: "intern",
};

function detail(overrides: Partial<BrassRingJobDetail>): BrassRingJobDetail {
  return {
    reqId: "123",
    title: "LabVIEW Developer",
    state: "Florida",
    businessArea: "Engineering",
    qualificationsSnippet: null,
    jobCode: null,
    program: null,
    lastUpdated: null,
    description: "Develop and maintain LabVIEW applications.",
    basicQualifications: "Professional software development experience.",
    city: null,
    cityState: "Florida",
    jobClass: "Engineering",
    employmentType: null,
    ...overrides,
  };
}

test("Lockheed adapter rejects full-time engineering roles without student signals", () => {
  const result = parseLockheedMartinJobs(
    [
      detail({
        title: "EMI/EMC/E3 Engineer",
        reqId: "853006",
        cityState: "Colorado, Florida, Texas",
      }),
    ],
    source,
    1,
  );

  assert.equal(result.roles.length, 0);
  assert.equal(result.stats.rejected[0]?.reason, "no_student_signal");
});

test("Lockheed jobs portal resolves platform from source URL", () => {
  assert.equal(resolveLockheedMartinPlatform(jobsSource), "jobs_portal");
  assert.equal(resolveLockheedMartinPlatform(source), "brassring");
});

test("Lockheed jobs portal parses search HTML and keeps engineering interns", () => {
  const html = `
    <ul>
      <li>
        <a href="/job/herndon/software-engineer-intern/694/96550161600">
          <span class="job-title">Software Engineer Intern</span>
          <span class="job-location">Herndon, Virginia</span>
        </a>
      </li>
      <li>
        <a href="/job/orlando/program-finance-evm-forecasting-orlando-fl/694/96603727696">
          <span class="job-title">Program Finance / EVM / Forecasting / Orlando, FL</span>
          <span class="job-location">Orlando, Florida</span>
        </a>
      </li>
    </ul>
  `;

  const listings = parseLockheedJobsSearchHtml(html, "https://www.lockheedmartinjobs.com");
  assert.equal(listings.length, 2);

  const result = parseLockheedJobsListings(
    listings.map((listing) =>
      listing.title.includes("Software Engineer Intern")
        ? {
            ...listing,
            description:
              "Software engineering internship supporting mission software development for defense programs.",
          }
        : listing,
    ),
    jobsSource,
  );

  assert.equal(result.roles.length, 1);
  assert.match(result.roles[0]?.roleName ?? "", /Software Engineer Intern/);
});

