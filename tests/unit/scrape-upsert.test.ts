import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyScrapeRole } from "../../lib/scraping/classify-role.ts";
import { buildScrapedRole } from "../../lib/scraping/scraped-role-build.ts";
import {
  buildScrapedPostingUpsertRows,
  mapCompanySourceRow,
  runScrapeAdapter,
} from "../../lib/scraping/upsert.ts";
import type { CompanySourceConfig, ScrapeAdapter, ScrapedRole } from "../../lib/scraping/types.ts";
import { CountryAllowlist } from "../../lib/scraping/country-allowlist.ts";

const SOURCE = { id: "source-uuid", companyId: "company-uuid" };

function buildRole(overrides: Partial<Parameters<typeof buildScrapedRole>[0]> & { title: string; url: string; locations?: string[] }): ScrapedRole {
  const classification = classifyScrapeRole({
    title: overrides.title,
    locations: overrides.locations ?? [],
  });
  assert.equal(classification.include, true, `expected ${overrides.title} to classify`);
  return buildScrapedRole({
    postingUrl: overrides.url,
    roleName: overrides.title,
    companyName: "Example",
    companySlug: "example",
    classification,
    description: overrides.description,
  });
}

test("upsert rows preserve first_seen_at for existing posting URLs", () => {
  const now = "2026-05-30T12:00:00.000Z";
  const existing = new Map([
    ["https://boards.example/jobs/1", { first_seen_at: "2026-01-01T00:00:00.000Z" }],
  ]);

  const rows = buildScrapedPostingUpsertRows(
    [
      buildRole({ title: "Software Engineer Intern", url: "https://boards.example/jobs/1", locations: ["New York, NY"] }),
      buildRole({ title: "Backend Intern, Fall 2026", url: "https://boards.example/jobs/2", locations: ["San Francisco, CA"] }),
    ],
    SOURCE,
    now,
    existing,
  );

  assert.equal(rows.length, 2);
  assert.equal(rows[0].first_seen_at, "2026-01-01T00:00:00.000Z");
  assert.equal(rows[0].last_seen_at, now);
  assert.equal(rows[0].status, "open");
  assert.equal(rows[0].source_id, "source-uuid");
  assert.equal(rows[1].first_seen_at, now);
  assert.equal(rows[1].season, "Fall");
});

test("global locations are persisted, not trimmed to the US", () => {
  const now = "2026-05-30T12:00:00.000Z";

  const rows = buildScrapedPostingUpsertRows(
    [
      buildRole({
        title: "Software Engineer Intern",
        url: "https://boards.example/jobs/multi",
        locations: ["New York, NY", "London, United Kingdom"],
      }),
      buildRole({
        title: "Backend Intern",
        url: "https://boards.example/jobs/foreign",
        locations: ["Tel Aviv District, IL"],
      }),
    ],
    SOURCE,
    now,
    new Map(),
  );

  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0].countries, ["GB", "US"]);
  assert.match(rows[0].location ?? "", /London, United Kingdom/);
  assert.deepEqual(rows[1].countries, ["IL"]);
  assert.equal(rows[1].location, "Tel Aviv, Israel");
});

test("unknown metadata defaults season to Summer with the raw location preserved", () => {
  const now = "2026-05-30T12:00:00.000Z";

  const rows = buildScrapedPostingUpsertRows(
    [
      buildRole({
        title: "Software Engineer Intern",
        url: "https://boards.example/jobs/unknown",
        locations: ["Flexible - Any Site"],
      }),
    ],
    SOURCE,
    now,
    new Map(),
  );

  assert.equal(rows.length, 1, "unparseable location must not drop the role");
  assert.equal(rows[0].location, null);
  assert.equal(rows[0].raw_location, "Flexible - Any Site");
  assert.equal(rows[0].season, "Summer", "no stated season defaults to Summer");
  assert.equal(rows[0].location_confidence, null);
  assert.deepEqual(rows[0].countries, []);
  assert.equal(rows[0].role_type, "internship");
});

test("posting URLs are canonicalized and deduplicated", () => {
  const now = "2026-05-30T12:00:00.000Z";

  const rows = buildScrapedPostingUpsertRows(
    [
      buildRole({
        title: "Software Engineer Intern",
        url: "https://boards.example/jobs/1?utm_source=feed#apply",
        locations: ["New York, NY"],
      }),
      buildRole({
        title: "Software Engineer Intern",
        url: "https://boards.example/jobs/1?utm_source=other",
        locations: ["New York, NY"],
      }),
    ],
    SOURCE,
    now,
    new Map(),
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].posting_url, "https://boards.example/jobs/1");
});

function stubAdapter(config: Partial<CompanySourceConfig>, roles: ScrapedRole[], fetched: number): ScrapeAdapter {
  const source: CompanySourceConfig = {
    id: "source-uuid",
    companyId: "company-uuid",
    companySlug: "example",
    companyName: "Example",
    sourceType: "greenhouse",
    adapterKey: "greenhouse",
    sourceUrl: "https://boards.example",
    boardToken: "example",
    ...config,
  };
  return {
    source,
    async fetchRoles() {
      return { roles, stats: { fetched, kept: roles.length, rejected: [] } };
    },
  };
}

const noDb = null as unknown as SupabaseClient;

test("zero raw roles after a non-zero run is flagged suspicious", async () => {
  const adapter = stubAdapter({ lastFetchedCount: 34 }, [], 0);
  const result = await runScrapeAdapter(noDb, adapter, { dryRun: true });
  assert.equal(result.status, "suspicious_zero");
});

test("zero raw roles use the last healthy baseline even after broken attempts", async () => {
  const adapter = stubAdapter(
    {
      lastFetchedCount: 0,
      lastHealthyFetchedCount: 34,
    } as Partial<CompanySourceConfig>,
    [],
    0,
  );
  const result = await runScrapeAdapter(noDb, adapter, { dryRun: true });
  assert.equal(result.status, "suspicious_zero");
});

test("suspicious zero does not close stale roles or reset the healthy baseline", async () => {
  const supabase = createScrapeSupabaseStub({
    openRows: [{ id: "posting-1", posting_url: "https://boards.example/jobs/live" }],
  });
  const adapter = stubAdapter({ lastFetchedCount: 0 }, [], 0);

  const result = await runScrapeAdapter(supabase.client, adapter);

  assert.equal(result.status, "suspicious_zero");
  assert.deepEqual(supabase.closedPostingIds, []);
  assert.equal(supabase.companySourceUpdates.length, 1);
  assert.equal(supabase.companySourceUpdates[0].scrape_health_status, "suspicious_zero");
  assert.equal(supabase.companySourceUpdates[0].last_attempted_fetched_count, 0);
  assert.equal("last_healthy_fetched_count" in supabase.companySourceUpdates[0], false);
  assert.equal("last_fetched_count" in supabase.companySourceUpdates[0], false);
});

test("zero raw roles with no history is an ordinary empty result", async () => {
  const adapter = stubAdapter({ lastFetchedCount: null }, [], 0);
  const result = await runScrapeAdapter(noDb, adapter, { dryRun: true });
  assert.equal(result.status, "ok_no_roles");
});

test("zero relevant roles from a populated board is not suspicious", async () => {
  const adapter = stubAdapter({ lastFetchedCount: 12 }, [], 120);
  const result = await runScrapeAdapter(noDb, adapter, { dryRun: true });
  assert.equal(result.status, "ok_no_roles");
});

test("adapter failures surface as error results without throwing", async () => {
  const adapter: ScrapeAdapter = {
    source: stubAdapter({}, [], 0).source,
    async fetchRoles() {
      throw new Error("Greenhouse returned 404 for https://boards.example");
    },
  };
  const result = await runScrapeAdapter(noDb, adapter, { dryRun: true });
  assert.equal(result.status, "error");
  assert.match(result.error ?? "", /404/);
});

test("run results count unknown-location roles", async () => {
  const roles = [
    buildRole({ title: "Software Engineer Intern", url: "https://boards.example/jobs/1", locations: ["Anywhere"] }),
    buildRole({ title: "Platform Intern", url: "https://boards.example/jobs/2", locations: ["Toronto, ON"] }),
  ];
  const adapter = stubAdapter({ lastFetchedCount: 10 }, roles, 20);
  const result = await runScrapeAdapter(noDb, adapter, { dryRun: true });
  assert.equal(result.status, "ok");
  assert.equal(result.openCount, 2);
  assert.equal(result.unknownLocationCount, 1);
});

test("run openCount only includes rows visible in the public feed", async () => {
  const roles = [
    buildRole({ title: "Software Engineer Intern", url: "https://boards.example/jobs/us", locations: ["New York, NY"] }),
    buildRole({ title: "Software Engineer Intern", url: "https://boards.example/jobs/europe", locations: ["Europe"] }),
    buildRole({ title: "Software Engineer Intern", url: "https://boards.example/jobs/mx", locations: ["Mexico City, Mexico"] }),
  ];
  const adapter = stubAdapter({ lastFetchedCount: 10 }, roles, 20);
  const allowlist = new CountryAllowlist(["US"]);

  const result = await runScrapeAdapter(noDb, adapter, { dryRun: true, allowlist });

  assert.equal(result.status, "ok");
  assert.equal(result.openCount, 1);
  assert.equal(result.countryUnknownCount, 1);
  assert.equal(result.countryBlockedCount, 1);
});

test("mapCompanySourceRow accepts current source types and rejects unknown values", () => {
  const baseRow = {
    id: "source-uuid",
    source_type: "x_corp",
    adapter_key: "x_corp",
    source_url: "https://boards.example/x",
    board_token: null,
    last_fetched_count: 12,
    last_kept_count: 5,
    last_healthy_fetched_count: 34,
    last_healthy_kept_count: 8,
    companies: {
      id: "company-uuid",
      slug: "x-corp",
      name: "X Corp",
    },
  };

  assert.equal(mapCompanySourceRow(baseRow)?.sourceType, "x_corp");
  assert.equal(mapCompanySourceRow(baseRow)?.lastFetchedCount, 12);
  assert.equal(mapCompanySourceRow(baseRow)?.lastHealthyFetchedCount, 34);
  assert.equal(mapCompanySourceRow(baseRow)?.lastHealthyKeptCount, 8);
  assert.equal(mapCompanySourceRow({ ...baseRow, source_type: "not_a_real_source" }), null);
  assert.equal(mapCompanySourceRow({ ...baseRow, companies: null }), null);
});

interface ScrapeSupabaseStubOptions {
  openRows: Array<{ id: string; posting_url: string }>;
}

function createScrapeSupabaseStub(options: ScrapeSupabaseStubOptions) {
  const closedPostingIds: string[] = [];
  const companySourceUpdates: Array<Record<string, unknown>> = [];

  const client = {
    from(table: string) {
      if (table === "scraped_postings") {
        return {
          select(_columns: string, selectOptions?: { count?: string; head?: boolean }) {
            if (selectOptions?.head) {
              return {
                eq() {
                  return this;
                },
                then(resolve: (value: { count: number; error: null }) => void) {
                  resolve({ count: options.openRows.length, error: null });
                },
              };
            }

            return {
              eq() {
                return this;
              },
              order() {
                return this;
              },
              range() {
                return Promise.resolve({ data: options.openRows, error: null });
              },
            };
          },
          update() {
            return {
              in(_column: string, ids: string[]) {
                closedPostingIds.push(...ids);
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }

      if (table === "company_sources") {
        return {
          select() {
            return {
              eq() {
                return this;
              },
              maybeSingle() {
                return Promise.resolve({ data: { consecutive_unhealthy_runs: 0 }, error: null });
              },
            };
          },
          update(payload: Record<string, unknown>) {
            companySourceUpdates.push(payload);
            return {
              eq() {
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;

  return { client, closedPostingIds, companySourceUpdates };
}

test("allowlist assigns correct status to open, blocked, and unknown-country rows", () => {
  const allowlist = new CountryAllowlist(["US", "CA", "GB", "CH", "SG", "AU"]);
  const now = "2026-06-09T12:00:00.000Z";

  const rows = buildScrapedPostingUpsertRows(
    [
      buildRole({ title: "Software Engineer Intern", url: "https://boards.example/jobs/us", locations: ["New York, NY"] }),
      buildRole({ title: "Software Engineer Intern", url: "https://boards.example/jobs/mx", locations: ["Mexico City, Mexico"] }),
      buildRole({ title: "Software Engineer Intern", url: "https://boards.example/jobs/unknown", locations: ["Flexible - Any Site"] }),
    ],
    SOURCE,
    now,
    new Map(),
    allowlist,
  );

  assert.equal(rows.length, 3);
  const byUrl = new Map(rows.map((r) => [r.posting_url, r]));
  assert.equal(byUrl.get("https://boards.example/jobs/us")?.status, "open");
  assert.equal(byUrl.get("https://boards.example/jobs/mx")?.status, "country_blocked");
  assert.equal(byUrl.get("https://boards.example/jobs/unknown")?.status, "country_unknown");
});

test("without an allowlist, all rows default to open (backward compat)", () => {
  const now = "2026-06-09T12:00:00.000Z";

  const rows = buildScrapedPostingUpsertRows(
    [
      buildRole({ title: "Software Engineer Intern", url: "https://boards.example/jobs/mx2", locations: ["Mexico City, Mexico"] }),
    ],
    SOURCE,
    now,
    new Map(),
  );

  assert.equal(rows[0].status, "open");
});
