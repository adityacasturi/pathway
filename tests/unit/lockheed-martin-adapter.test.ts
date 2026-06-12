import assert from "node:assert/strict";
import test from "node:test";
import {
  parseLockheedMartinJobs,
  type BrassRingJobDetail,
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

