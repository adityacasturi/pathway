# Country Allowlist Design

**Date:** 2026-06-09  
**Status:** Approved

## Goal

Make country filtering part of the ingestion pipeline, with the database as the source of truth. Postings whose country is not enabled are stored but not shown in the public feed. Unknown-country postings are preserved in a reviewable state. A future admin app can query blocked and unknown postings without any schema changes.

---

## Database Changes

### New table: `allowed_countries`

```sql
create table public.allowed_countries (
  country_code  text primary key,        -- ISO 3166-1 alpha-2 (e.g. 'US', 'GB')
  country_name  text not null,
  enabled       boolean not null default false,
  tier          integer,                 -- 1 = Tier 1, 2 = Tier 2, etc.
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

RLS: authenticated clients may read; service role only for writes.

**Seeded enabled (tier 1):** US, CA, GB, CH, SG, AU.

**Seeded disabled (tier 2, ~20 rows):** DE, NL, FR, IE, SE, NO, DK, FI, JP, KR, IN, NZ, HK, IL, PL, AT, BE, PT, ES, IT — present as disabled rows so future enabling is a single SQL update.

### Extend `scraped_postings.status` check constraint

Current values: `'open' | 'closed'`  
New values: `'open' | 'closed' | 'country_blocked' | 'country_unknown'`

- `country_blocked` — at least one country was resolved but none are in the enabled allowlist
- `country_unknown` — `countries = '{}'`; location could not be parsed to any country

All existing feed queries filter `.eq("status", "open")`, so both new statuses are automatically excluded from user-facing feeds and the DB functions `discover_company_open_counts()` and `market_posting_summary()`. No feed code changes required.

`closeStaleScrapedPostings` already queries `status = 'open'` only, so blocked/unknown rows persist until re-scraped — correct for admin review.

### Partial index for admin review

```sql
create index scraped_postings_review_idx
  on public.scraped_postings (status, first_seen_at desc)
  where status in ('country_blocked', 'country_unknown');
```

### Backfill in migration

After creating the table and seeding it, immediately update existing open postings:

```sql
-- Unknown country first (empty array)
update public.scraped_postings
set status = 'country_unknown'
where status = 'open' and countries = '{}';

-- Country not allowed
update public.scraped_postings
set status = 'country_blocked'
where status = 'open'
  and countries <> '{}'
  and not exists (
    select 1 from public.allowed_countries ac
    where ac.enabled = true
      and ac.country_code = any(scraped_postings.countries)
  );
```

---

## Application Changes

### New module: `lib/scraping/country-allowlist.ts`

```ts
export type CountryAllowlistDecision =
  | { allowed: true }
  | { allowed: false; reason: 'country_not_allowed' }
  | { allowed: false; reason: 'country_unknown' };

export class CountryAllowlist {
  static async load(supabase): Promise<CountryAllowlist>
  check(countries: string[]): CountryAllowlistDecision
}
```

`check` logic:
- `countries.length === 0` → `{ allowed: false, reason: 'country_unknown' }`
- any code matches an enabled entry → `{ allowed: true }`
- no code matches → `{ allowed: false, reason: 'country_not_allowed' }`

ISO codes are uppercased on comparison; the alias/normalization already happens upstream in `buildScrapedRole()`.

### Thread through `run-all.ts`

Load the allowlist **once** in `runAllScrapes()` before kicking off scrape jobs (one DB read for the entire run, not one per company). Pass it via `RunScrapeAdapterOptions`:

```ts
interface RunScrapeAdapterOptions {
  dryRun?: boolean;
  allowlist?: CountryAllowlist;  // new, optional
}
```

### Update `buildScrapedPostingUpsertRows`

Accepts optional `allowlist?`. When present, each row's `status` is:

```ts
const decision = allowlist?.check(role.countries) ?? { allowed: true };
const status = decision.allowed
  ? "open"
  : decision.reason === "country_unknown"
    ? "country_unknown"
    : "country_blocked";
```

Backward compatible: if `allowlist` is absent (tests, dry-run without DB), defaults to `"open"`.

`ScrapedPostingUpsertRow.status` type updated to `"open" | "country_blocked" | "country_unknown"`.

### Scrape metrics

Add optional fields to `SourceScrapeResult`:

```ts
countryBlockedCount?: number;
countryUnknownCount?: number;
```

Populated from upsert row counts; surfaced in CLI verbose output.

---

## Tests

New file `tests/unit/scrape-country-allowlist.test.ts`:

| Case | Input | Expected |
|---|---|---|
| Tier-1 single country | `["US"]` | `allowed: true` |
| All six tier-1 countries | `["CA"]` etc. | `allowed: true` |
| Non-tier-1 | `["MX"]`, `["IN"]`, `["BR"]` | `country_not_allowed` |
| Empty countries | `[]` | `country_unknown` |
| Multi-country, one allowed | `["US", "MX"]` | `allowed: true` |
| Multi-country, none allowed | `["MX", "BR"]` | `country_not_allowed` |

Update `tests/unit/scrape-upsert.test.ts` to add a test that verifies blocked/unknown rows receive the correct `status` field when an allowlist is passed.

---

## How to enable/disable a country later

```sql
-- Enable a country (takes effect on next scrape)
update allowed_countries set enabled = true, updated_at = now()
where country_code = 'DE';

-- Disable a country
update allowed_countries set enabled = false, updated_at = now()
where country_code = 'AU';
```

The next scrape run re-evaluates all postings for active companies. A newly-enabled country's postings become `open`. A newly-disabled country's postings become `country_blocked`.

---

## Future admin app queries

```sql
-- Postings held back: unknown country
select company_name, role_name, raw_location, posting_url, first_seen_at
from scraped_postings
where status = 'country_unknown'
order by first_seen_at desc;

-- Postings held back: country not allowed
select company_name, role_name, countries, location, raw_location, posting_url, first_seen_at
from scraped_postings
where status = 'country_blocked'
order by first_seen_at desc;

-- Summary
select status, count(*) from scraped_postings
where status in ('country_blocked', 'country_unknown')
group by status;
```

---

## Files to create/modify

| Action | File |
|---|---|
| Create | `lib/scraping/country-allowlist.ts` |
| Modify | `lib/scraping/upsert.ts` |
| Modify | `lib/scraping/run-all.ts` |
| Modify | `lib/scraping/types.ts` |
| Create | `tests/unit/scrape-country-allowlist.test.ts` |
| Modify | `tests/unit/scrape-upsert.test.ts` |
| Create | `supabase/migrations/20260609180000_country_allowlist.sql` |
| Apply | Migration via Supabase MCP `apply_migration` |
