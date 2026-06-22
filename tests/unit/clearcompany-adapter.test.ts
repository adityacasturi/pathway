import assert from "node:assert/strict";
import test from "node:test";
import {
  createClearCompanyAdapter,
  formatClearCompanyLocation,
  normalizeClearCompanyPostingUrl,
  parseClearCompanyJobs,
  resolveClearCompanySiteId,
} from "../../lib/scraping/adapters/clearcompany.ts";
import type { CompanySourceConfig } from "../../lib/scraping/types.ts";

const source: CompanySourceConfig = {
  id: "source-firefly",
  companyId: "company-firefly",
  companyName: "Firefly Aerospace",
  companySlug: "firefly-aerospace",
  sourceType: "clearcompany",
  adapterKey: "firefly-aerospace",
  sourceUrl: "https://fireflyspace.com/careers/",
  boardToken: "00ed92c3-5bfb-7bfb-456d-4d9d77fef9a5",
  lastFetchedCount: null,
};

test("resolveClearCompanySiteId prefers explicit board token", () => {
  assert.equal(resolveClearCompanySiteId(source), "00ed92c3-5bfb-7bfb-456d-4d9d77fef9a5");
});

test("resolveClearCompanySiteId falls back to siteId query param", () => {
  assert.equal(
    resolveClearCompanySiteId({
      ...source,
      boardToken: null,
      sourceUrl:
        "https://careers-content.clearcompany.com/js/v1/career-site.js?siteId=abc-123",
    }),
    "abc-123",
  );
});

test("normalizeClearCompanyPostingUrl strips trailing apply segment and query", () => {
  assert.equal(
    normalizeClearCompanyPostingUrl(
      "https://firefly.clearcompany.com/careers/jobs/efebbd36/apply?source=site",
    ),
    "https://firefly.clearcompany.com/careers/jobs/efebbd36",
  );
});

test("formatClearCompanyLocation joins city, subdivision, country", () => {
  assert.equal(
    formatClearCompanyLocation({ city: "Cedar Park", subdivision: "TX", country: "US" }),
    "Cedar Park, TX, US",
  );
  assert.equal(formatClearCompanyLocation({ isRemote: true }), "Remote");
  assert.equal(formatClearCompanyLocation({}), null);
});

test("parseClearCompanyJobs keeps internships and rejects senior roles", () => {
  const result = parseClearCompanyJobs(
    [
      {
        id: "job-1",
        positionTitle: "Internship - Electrical Engineering - Fall 2026",
        description: "<p>Join our launch vehicle team.</p>",
        departmentName: "Avionics",
        location: "Cedar Park TX",
        locations: [{ city: "Cedar Park", subdivision: "TX", country: "US" }],
        applyLink: "https://firefly.clearcompany.com/careers/jobs/job-1/apply",
      },
      {
        id: "job-2",
        positionTitle: "Principal Flight Dynamics Engineer",
        departmentName: "Aerospace Software Engineering",
        locations: [{ city: "Cedar Park", subdivision: "TX", country: "US" }],
        applyLink: "https://firefly.clearcompany.com/careers/jobs/job-2/apply",
      },
    ],
    source,
  );

  assert.equal(result.stats.fetched, 2);
  assert.equal(result.roles.length, 1);
  assert.equal(result.roles[0]?.roleName, "Internship - Electrical Engineering - Fall 2026");
  assert.equal(
    result.roles[0]?.postingUrl,
    "https://firefly.clearcompany.com/careers/jobs/job-1",
  );
  assert.equal(result.stats.rejected.length, 1);
});

test("createClearCompanyAdapter requests identity encoding", async () => {
  const originalFetch = globalThis.fetch;
  const calls: RequestInit[] = [];

  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    calls.push(init ?? {});
    return Response.json({ results: [] });
  }) as typeof fetch;

  try {
    const adapter = createClearCompanyAdapter(source);
    await adapter.fetchRoles();
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls.length, 1);
  assert.equal((calls[0]?.headers as Record<string, string>)?.["accept-encoding"], "identity");
});
