# Country Allowlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a database-backed country allowlist that controls which scraped postings are visible in the public feed, preserving blocked and unknown-country postings for future admin review.

**Architecture:** A new `allowed_countries` table seeds tier-1 countries (US/CA/GB/CH/SG/AU) as enabled. The scrape upsert pipeline checks each posting's ISO country codes against the allowlist and writes `status = 'country_blocked'` or `'country_unknown'` instead of `'open'` for non-allowed postings. All existing feed queries already filter `status = 'open'`, so user-facing feeds automatically exclude these rows with no other changes.

**Tech Stack:** Supabase Postgres (migration via MCP `apply_migration`), TypeScript (Node.js ESM, `node:test`), Supabase JS client.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `lib/scraping/country-allowlist.ts` | Loads enabled codes from DB; `check(countries)` returns allow/block/unknown decision |
| Create | `tests/unit/scrape-country-allowlist.test.ts` | Unit tests for `CountryAllowlist` (no DB) |
| Modify | `lib/scraping/types.ts` | Add `countryBlockedCount?` / `countryUnknownCount?` to `SourceScrapeResult` |
| Modify | `lib/scraping/upsert.ts` | Thread `allowlist` through `buildScrapedPostingUpsertRows`; compute status per row |
| Modify | `lib/scraping/run-all.ts` | Load allowlist once before scrape jobs; pass via `RunScrapeAdapterOptions` |
| Modify | `tests/unit/scrape-upsert.test.ts` | Add test: allowlist produces correct status values on rows |
| Create | `supabase/migrations/20260609180000_country_allowlist.sql` | Schema, seed data, constraint, backfill |

---

## Task 1: Create the migration SQL file

**Files:**
- Create: `supabase/migrations/20260609180000_country_allowlist.sql`

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260609180000_country_allowlist.sql` with this exact content:

```sql
-- Country allowlist: database-backed country filtering for scraped postings.

-- 1. allowed_countries table -------------------------------------------------

create table if not exists public.allowed_countries (
  country_code  text primary key
    check (country_code = upper(country_code) and char_length(country_code) = 2),
  country_name  text not null check (char_length(country_name) > 0),
  enabled       boolean not null default false,
  tier          integer check (tier is null or tier between 1 and 9),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.allowed_countries is
  'ISO 3166-1 alpha-2 country allowlist. enabled=true countries appear in the public feed.';

alter table public.allowed_countries enable row level security;

create policy "allowed_countries_authenticated_read"
  on public.allowed_countries
  for select
  to authenticated
  using (true);

grant select on public.allowed_countries to authenticated;

-- 2. Seed data ---------------------------------------------------------------

insert into public.allowed_countries (country_code, country_name, enabled, tier) values
  ('US', 'United States',  true,  1),
  ('CA', 'Canada',         true,  1),
  ('GB', 'United Kingdom', true,  1),
  ('CH', 'Switzerland',    true,  1),
  ('SG', 'Singapore',      true,  1),
  ('AU', 'Australia',      true,  1),
  ('DE', 'Germany',        false, 2),
  ('NL', 'Netherlands',    false, 2),
  ('FR', 'France',         false, 2),
  ('IE', 'Ireland',        false, 2),
  ('SE', 'Sweden',         false, 2),
  ('NO', 'Norway',         false, 2),
  ('DK', 'Denmark',        false, 2),
  ('FI', 'Finland',        false, 2),
  ('AT', 'Austria',        false, 2),
  ('BE', 'Belgium',        false, 2),
  ('NZ', 'New Zealand',    false, 2),
  ('HK', 'Hong Kong',      false, 2),
  ('JP', 'Japan',          false, 2),
  ('KR', 'South Korea',    false, 2),
  ('IL', 'Israel',         false, 2),
  ('IN', 'India',          false, 2),
  ('PT', 'Portugal',       false, 2),
  ('ES', 'Spain',          false, 2),
  ('IT', 'Italy',          false, 2),
  ('PL', 'Poland',         false, 2)
on conflict (country_code) do nothing;

-- 3. Extend scraped_postings.status ------------------------------------------

alter table public.scraped_postings
  drop constraint scraped_postings_status_check,
  add constraint scraped_postings_status_check
    check (status = any (array[
      'open'::text,
      'closed'::text,
      'country_blocked'::text,
      'country_unknown'::text
    ]));

-- 4. Partial index for admin review queries -----------------------------------

create index if not exists scraped_postings_review_idx
  on public.scraped_postings (status, first_seen_at desc)
  where status in ('country_blocked', 'country_unknown');

-- 5. Backfill existing open postings -----------------------------------------

-- Unknown country first (empty countries array → no geo resolution)
update public.scraped_postings
set status = 'country_unknown'
where status = 'open'
  and countries = '{}';

-- Country resolved but not in the enabled allowlist
update public.scraped_postings
set status = 'country_blocked'
where status = 'open'
  and countries <> '{}'
  and not exists (
    select 1
    from public.allowed_countries ac
    where ac.enabled = true
      and ac.country_code = any(scraped_postings.countries)
  );
```

---

## Task 2: Apply the migration

**Files:** (no TypeScript changes — Supabase only)

- [ ] **Step 1: Apply via Supabase MCP `apply_migration`**

Use `apply_migration` with:
- `name`: `country_allowlist`
- `query`: the full SQL from `supabase/migrations/20260609180000_country_allowlist.sql`

- [ ] **Step 2: Verify with `list_migrations`**

Run `list_migrations` for project `vfcithtpstkipchvqlnd`. Confirm `country_allowlist` appears at the end of the list.

- [ ] **Step 3: Verify seed data and backfill**

Run SQL:
```sql
-- Confirm 6 enabled tier-1 rows
select country_code, country_name, enabled, tier
from allowed_countries
where enabled = true
order by country_code;

-- Confirm status constraint is updated
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.scraped_postings'::regclass
  and conname = 'scraped_postings_status_check';

-- Confirm backfill ran (check distribution)
select status, count(*)
from scraped_postings
group by status
order by status;
```

Expected: 6 enabled rows (AU, CA, CH, GB, SG, US), constraint includes `country_blocked` and `country_unknown`, backfill counts are non-negative integers.

- [ ] **Step 4: Run integrity check**

```sql
select * from app_private.production_integrity_check();
```

Expected: all rows show `violations = 0`.

- [ ] **Step 5: Commit the migration file**

```bash
git add supabase/migrations/20260609180000_country_allowlist.sql
git commit -m "Add country allowlist migration: allowed_countries table, status extension, backfill"
```

---

## Task 3: Write failing tests for CountryAllowlist

**Files:**
- Create: `tests/unit/scrape-country-allowlist.test.ts`

- [ ] **Step 1: Write the test file**

Create `tests/unit/scrape-country-allowlist.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { CountryAllowlist } from "../../lib/scraping/country-allowlist.ts";

const TIER1 = ["US", "CA", "GB", "CH", "SG", "AU"];
const allowlist = new CountryAllowlist(TIER1);

for (const code of TIER1) {
  test(`tier-1 country ${code} is allowed`, () => {
    const result = allowlist.check([code]);
    assert.equal(result.allowed, true);
  });
}

test("empty countries array → country_unknown", () => {
  const result = allowlist.check([]);
  assert.equal(result.allowed, false);
  assert.ok(!result.allowed && result.reason === "country_unknown");
});

test("non-tier-1 country → country_not_allowed", () => {
  for (const code of ["MX", "IN", "BR", "PH", "ID"]) {
    const result = allowlist.check([code]);
    assert.equal(result.allowed, false, `expected ${code} to be blocked`);
    assert.ok(!result.allowed && result.reason === "country_not_allowed", code);
  }
});

test("multi-country with at least one allowed → allowed", () => {
  const result = allowlist.check(["MX", "US"]);
  assert.equal(result.allowed, true);
});

test("multi-country with none allowed → country_not_allowed", () => {
  const result = allowlist.check(["MX", "BR"]);
  assert.equal(result.allowed, false);
  assert.ok(!result.allowed && result.reason === "country_not_allowed");
});

test("country codes are compared case-insensitively", () => {
  assert.equal(allowlist.check(["us"]).allowed, true);
  assert.equal(allowlist.check(["gb"]).allowed, true);
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
npm run test:unit -- --test-name-pattern "tier-1|empty countries|non-tier-1|multi-country|case-insensitively"
```

Expected: `ReferenceError` or module-not-found for `country-allowlist.ts` (the file does not exist yet).

---

## Task 4: Implement CountryAllowlist

**Files:**
- Create: `lib/scraping/country-allowlist.ts`

- [ ] **Step 1: Create the module**

Create `lib/scraping/country-allowlist.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type CountryAllowlistDecision =
  | { allowed: true }
  | { allowed: false; reason: "country_not_allowed" | "country_unknown" };

export class CountryAllowlist {
  private readonly enabledCodes: ReadonlySet<string>;

  constructor(enabledCodes: Iterable<string>) {
    this.enabledCodes = new Set([...enabledCodes].map((c) => c.toUpperCase()));
  }

  check(countries: readonly string[]): CountryAllowlistDecision {
    if (countries.length === 0) {
      return { allowed: false, reason: "country_unknown" };
    }
    for (const code of countries) {
      if (this.enabledCodes.has(code.toUpperCase())) {
        return { allowed: true };
      }
    }
    return { allowed: false, reason: "country_not_allowed" };
  }

  static async load(supabase: SupabaseClient): Promise<CountryAllowlist> {
    const { data, error } = await supabase
      .from("allowed_countries")
      .select("country_code")
      .eq("enabled", true);
    if (error) throw error;
    return new CountryAllowlist((data ?? []).map((r) => r.country_code));
  }
}
```

- [ ] **Step 2: Run the tests and confirm they pass**

```bash
npm run test:unit -- --test-name-pattern "tier-1|empty countries|non-tier-1|multi-country|case-insensitively"
```

Expected: all 12 tests pass, 0 failures.

- [ ] **Step 3: Commit**

```bash
git add lib/scraping/country-allowlist.ts tests/unit/scrape-country-allowlist.test.ts
git commit -m "Add CountryAllowlist: DB-backed check with country_not_allowed / country_unknown reasons"
```

---

## Task 5: Write failing test for allowlist-filtered upsert rows

**Files:**
- Modify: `tests/unit/scrape-upsert.test.ts`

- [ ] **Step 1: Add a static import at the top of `tests/unit/scrape-upsert.test.ts`**

Add this line after the existing imports (after the `import type { CompanySourceConfig, ... }` line):

```ts
import { CountryAllowlist } from "../../lib/scraping/country-allowlist.ts";
```

- [ ] **Step 2: Append two new tests at the end of `tests/unit/scrape-upsert.test.ts`**

```ts
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
```

- [ ] **Step 3: Run to confirm the tests fail**

```bash
npm run test:unit -- --test-name-pattern "allowlist assigns|without an allowlist"
```

Expected: TypeScript error — `buildScrapedPostingUpsertRows` does not accept a 5th argument yet.

---

## Task 6: Update `types.ts` and `upsert.ts`

**Files:**
- Modify: `lib/scraping/types.ts` (lines ~139–179, `SourceScrapeResult` interface)
- Modify: `lib/scraping/upsert.ts`

### 6a — `types.ts`

- [ ] **Step 1: Add `countryBlockedCount` and `countryUnknownCount` to `SourceScrapeResult`**

In `lib/scraping/types.ts`, find the `SourceScrapeResult` interface and add two optional fields after `lowConfidenceLocationCount`:

```ts
export interface SourceScrapeResult {
  slug: string;
  status: SourceScrapeStatus;
  openCount: number;
  error?: string;
  stats?: RoleParseStats;
  keptPreview?: KeptRolePreview[];
  /** Roles persisted with no resolvable location (honest unknowns). */
  unknownLocationCount?: number;
  /** Roles persisted with parser-level (low) location confidence. */
  lowConfidenceLocationCount?: number;
  /** Roles written as country_blocked (country resolved, not in allowlist). */
  countryBlockedCount?: number;
  /** Roles written as country_unknown (no country resolved). */
  countryUnknownCount?: number;
  durationMs?: number;
}
```

### 6b — `upsert.ts`

- [ ] **Step 2: Add import for CountryAllowlist**

At the top of `lib/scraping/upsert.ts`, add:

```ts
import { CountryAllowlist } from "./country-allowlist.ts";
```

- [ ] **Step 3: Update `RunScrapeAdapterOptions`**

Find the `RunScrapeAdapterOptions` interface in `upsert.ts` and add the `allowlist` field:

```ts
interface RunScrapeAdapterOptions {
  dryRun?: boolean;
  allowlist?: CountryAllowlist;
}
```

- [ ] **Step 4: Update `ScrapedPostingUpsertRow` status type**

Find the `ScrapedPostingUpsertRow` interface and change:

```ts
  status: "open";
```

to:

```ts
  status: "open" | "country_blocked" | "country_unknown";
```

- [ ] **Step 5: Update `buildScrapedPostingUpsertRows` signature and row status logic**

Find `buildScrapedPostingUpsertRows`. Change its signature to add the optional fifth parameter:

```ts
export function buildScrapedPostingUpsertRows(
  roles: ScrapedRole[],
  source: Pick<CompanySourceConfig, "id" | "companyId">,
  now: string,
  existingByUrl: ReadonlyMap<string, ExistingPostingState>,
  allowlist?: CountryAllowlist,
): ScrapedPostingUpsertRow[]
```

Inside the function body, replace the hardcoded `status: "open" as const` in the `rows.push({...})` call with a computed value. Find this section:

```ts
    rows.push({
      company_id: source.companyId,
      company_name: role.companyName,
      role_name: role.roleName,
      posting_url: postingUrl,
      role_type: role.roleType,
      season: role.season,
      location: role.location,
      raw_location: role.rawLocation,
      location_places: canonicalPlacesToJson(role.places),
      location_confidence: role.locationConfidence,
      countries: role.countries,
      source_id: source.id,
      status: "open" as const,
      first_seen_at: existing?.first_seen_at ?? now,
      last_seen_at: now,
    });
```

Replace with:

```ts
    const decision = allowlist?.check(role.countries) ?? { allowed: true as const };
    const status: "open" | "country_blocked" | "country_unknown" = decision.allowed
      ? "open"
      : decision.reason === "country_unknown"
        ? "country_unknown"
        : "country_blocked";

    rows.push({
      company_id: source.companyId,
      company_name: role.companyName,
      role_name: role.roleName,
      posting_url: postingUrl,
      role_type: role.roleType,
      season: role.season,
      location: role.location,
      raw_location: role.rawLocation,
      location_places: canonicalPlacesToJson(role.places),
      location_confidence: role.locationConfidence,
      countries: role.countries,
      source_id: source.id,
      status,
      first_seen_at: existing?.first_seen_at ?? now,
      last_seen_at: now,
    });
```

- [ ] **Step 6: Thread allowlist through `upsertScrapedRoles`**

Find the private `upsertScrapedRoles` function. Update its signature:

```ts
async function upsertScrapedRoles(
  supabase: SupabaseClient,
  adapter: ScrapeAdapter,
  roles: ScrapedRole[],
  allowlist?: CountryAllowlist,
): Promise<number>
```

Inside the function, find the call to `buildScrapedPostingUpsertRows` and pass `allowlist`:

```ts
  const rows = buildScrapedPostingUpsertRows(roles, adapter.source, now, existingByUrl, allowlist);
```

- [ ] **Step 7: Update `runScrapeAdapter` to use allowlist and populate new stats fields**

In `runScrapeAdapter`, find the first `buildScrapedPostingUpsertRows` call (used for stats) and add `options.allowlist`:

```ts
    const rows = buildScrapedPostingUpsertRows(
      parsed.roles,
      adapter.source,
      new Date().toISOString(),
      new Map(),
      options.allowlist,
    );
```

Then find the `baseResult` object and add the two new count fields:

```ts
    const baseResult = {
      slug,
      status,
      stats,
      keptPreview: buildKeptPreview(rows),
      unknownLocationCount: rows.filter((row) => row.location === null).length,
      lowConfidenceLocationCount: rows.filter(
        (row) => row.location_confidence !== null && row.location_confidence < LOW_CONFIDENCE_THRESHOLD,
      ).length,
      countryBlockedCount: rows.filter((row) => row.status === "country_blocked").length,
      countryUnknownCount: rows.filter((row) => row.status === "country_unknown").length,
    };
```

Finally, find the call to `upsertScrapedRoles` and pass the allowlist:

```ts
    const openCount = await upsertScrapedRoles(supabase, adapter, parsed.roles, options.allowlist);
```

- [ ] **Step 8: Run the failing tests and confirm they now pass**

```bash
npm run test:unit -- --test-name-pattern "allowlist assigns|without an allowlist"
```

Expected: both tests pass.

- [ ] **Step 9: Run the full unit test suite**

```bash
npm run test:unit
```

Expected: all tests pass, 0 failures.

- [ ] **Step 10: Commit**

```bash
git add lib/scraping/types.ts lib/scraping/upsert.ts tests/unit/scrape-upsert.test.ts
git commit -m "Thread CountryAllowlist through upsert pipeline; assign country_blocked / country_unknown status"
```

---

## Task 7: Update `run-all.ts` to load and thread the allowlist

**Files:**
- Modify: `lib/scraping/run-all.ts`

- [ ] **Step 1: Add the import**

At the top of `lib/scraping/run-all.ts`, add:

```ts
import { CountryAllowlist } from "./country-allowlist.ts";
```

- [ ] **Step 2: Load the allowlist once before scrape jobs begin**

In `runAllScrapes`, find the block that reads enabled company sources. After `if (error) { throw error; }` and before the job-building loop, add:

```ts
  const allowlist = await CountryAllowlist.load(supabase);
```

The placement should look like this in context:

```ts
  if (error) {
    throw error;
  }

  const allowlist = await CountryAllowlist.load(supabase);

  const rows = (data ?? []) as unknown as CompanySourceRow[];
  rows.sort((a, b) => ...);
```

- [ ] **Step 3: Pass allowlist into each `runScrapeAdapter` call**

Find the `pool.run` call inside `mapWithConcurrency`:

```ts
    const result = await pool.run(hostKey, () =>
      runScrapeAdapter(supabase, job.adapter!, { dryRun: options.dryRun }),
    );
```

Change to:

```ts
    const result = await pool.run(hostKey, () =>
      runScrapeAdapter(supabase, job.adapter!, { dryRun: options.dryRun, allowlist }),
    );
```

- [ ] **Step 4: Run the full unit test suite**

```bash
npm run test:unit
```

Expected: all tests pass.

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add lib/scraping/run-all.ts
git commit -m "Load CountryAllowlist once in runAllScrapes and pass to each adapter"
```

---

## Task 8: Final verification

- [ ] **Step 1: Run the full pre-prod suite**

```bash
npm run test:preprod
```

Expected: lint, typecheck, audit, unit tests, and build all pass.

- [ ] **Step 2: Manual spot-check via dry-run**

```bash
npm run scrape -- --dry-run --verbose stripe
```

Look for `countryBlockedCount` and `countryUnknownCount` in verbose output. If the adapter returns roles from multiple countries, confirm counts are non-zero where expected.

- [ ] **Step 3: Verify the DB backfill result**

```sql
-- Check distribution after backfill
select status, count(*) from scraped_postings group by status order by status;

-- Sample a few country_blocked rows to confirm they have useful metadata
select company_name, role_name, countries, raw_location, posting_url
from scraped_postings
where status = 'country_blocked'
limit 10;

-- Sample country_unknown rows
select company_name, role_name, raw_location, posting_url
from scraped_postings
where status = 'country_unknown'
limit 10;
```

- [ ] **Step 4: Confirm public feed still works**

Start the dev server (`npm run dev`) and visit `/openings`. Confirm the feed loads and contains only postings from allowed countries. Confirm no TypeScript or runtime errors in the terminal.

- [ ] **Step 5: Final commit if any loose files remain**

```bash
git status
```

If clean: done. If not:

```bash
git add -p   # stage any remaining changes selectively
git commit -m "Country allowlist: final cleanup"
```

---

## Admin queries (reference)

Enable a country after this ships:

```sql
update allowed_countries
set enabled = true, updated_at = now()
where country_code = 'DE';
```

Query review-needed postings:

```sql
-- Unknown country
select company_name, role_name, raw_location, posting_url, first_seen_at
from scraped_postings
where status = 'country_unknown'
order by first_seen_at desc;

-- Country not allowed
select company_name, role_name, countries, location, raw_location, posting_url, first_seen_at
from scraped_postings
where status = 'country_blocked'
order by first_seen_at desc;
```
