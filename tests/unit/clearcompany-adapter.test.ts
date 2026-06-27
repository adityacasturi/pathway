import assert from "node:assert/strict";
import test from "node:test";
import {
  buildClearCompanyListUrl,
  createClearCompanyAdapter,
  formatClearCompanyLocation,
  mergeClearCompanyJobPages,
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

test("buildClearCompanyListUrl requests paginated payloads", () => {
  assert.equal(
    buildClearCompanyListUrl("abc-123", 2),
    "https://careers-api.clearcompany.com/v1/abc-123?pageIndex=2&pageSize=25",
  );
});

test("mergeClearCompanyJobPages dedupes jobs across pages", () => {
  const merged = mergeClearCompanyJobPages([
    [{ id: "job-1", positionTitle: "Intern" }],
    [
      { id: "job-1", positionTitle: "Intern" },
      { id: "job-2", positionTitle: "Engineer" },
    ],
  ]);

  assert.deepEqual(
    merged.map((job) => job.id),
    ["job-1", "job-2"],
  );
});

test("createClearCompanyAdapter paginates until a short page", async () => {
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];

  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    urls.push(url);
    const page = Number(new URL(url).searchParams.get("pageIndex") ?? "0");
    const results =
      page === 0
        ? Array.from({ length: 25 }, (_, index) => ({
            id: `job-${index}`,
            positionTitle: index === 0 ? "Internship - Electrical Engineering - Fall 2026" : `Role ${index}`,
            applyLink: `https://firefly.clearcompany.com/careers/jobs/job-${index}/apply`,
            locations: [{ city: "Cedar Park", subdivision: "TX", country: "US" }],
          }))
        : [{ id: "job-25", positionTitle: "Principal Engineer", applyLink: "https://firefly.clearcompany.com/careers/jobs/job-25/apply" }];
    return Response.json({ results, totalCount: 26 });
  }) as typeof fetch;

  try {
    const adapter = createClearCompanyAdapter(source);
    const result = await adapter.fetchRoles();
    assert.equal(urls.length, 2);
    assert.match(urls[0] ?? "", /pageIndex=0&pageSize=25/);
    assert.match(urls[1] ?? "", /pageIndex=1&pageSize=25/);
    assert.equal(result.stats.fetched, 26);
    assert.equal(result.roles.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
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

  assert.ok(calls.length >= 1);
  assert.equal((calls[0]?.headers as Record<string, string>)?.["accept-encoding"], "identity");
});
