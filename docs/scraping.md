# Scraping and Discover catalog

Pathway ingests internship postings from employer ATS boards into `scraped_postings`. **Live** and **Discover** read that store; they never scrape in the browser.

## Commands

```bash
# All enabled companies (parallel, default concurrency 8)
npm run scrape

# One company
npm run scrape -- stripe

# No database writes
npm run scrape -- --dry-run --verbose stripe

# Help
npm run scrape -- --help
```

Environment:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Required for writes |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SCRAPER_VERBOSE=1` | Same as `--verbose` |
| `SCRAPE_COMPANY_CONCURRENCY` | Parallel companies (default 8, max 16) |

Cron (production): `GET/POST` `/api/cron/scrape-postings` with `Authorization: Bearer $CRON_SECRET` — scheduled hourly in `vercel.json`.

## Pipeline

```text
company_sources (enabled)
    → buildScrapeAdapter() in lib/scraping/registry.ts
    → adapter.fetchRoles()
    → classify (intern + engineering + US)
    → lib/scraping/upsert.ts → scraped_postings
```

Health columns on `company_sources`: `last_success_at`, `last_failure_at`.

## Source types

Canonical list: `SourceType` in `lib/scraping/types.ts`. Registration: `buildScrapeAdapter()` in `lib/scraping/registry.ts`.

**Generic ATS (often only need DB rows + standard adapter):**

- `greenhouse`, `ashby`, `lever`, `workday`
- `workable`, `hiringthing`, `surge`, `smartrecruiters`, `jobvite`, `breezy`

**Custom adapters (employer-specific APIs or HTML):** include `google`, `microsoft`, `amazon`, `meta`, `apple`, `tesla`, `nvidia`, `jane_street`, `hudson_river_trading`, `uber`, `salesforce`, `linkedin`, `oracle`, `goldman_sachs`, `jpmorgan_chase`, and others in the registry — copy an existing file under `lib/scraping/adapters/` when adding a new employer.

Adding a **new** `source_type` requires:

1. Adapter file + `registry.ts` branch
2. Extend `company_sources_source_type_check` in SQL (`apply_migration`)
3. Unit tests in `tests/unit/scraping-adapters.test.ts` when practical

## Role filters

Shared logic:

- `lib/scraping/classify-role.ts` — intern signals + engineering scope
- `lib/feed/roles.ts` — engineering title patterns for Live/Discover
- `lib/feed/us-locations.ts` — US location trim and rejection

Rules (biased toward keeping real interns):

- Title/metadata/description intern signals (`intern`, `co-op`, `university`, etc.). `early career` alone is **not** enough (often full-time new grad).
- Must match engineering scope; non-engineering intern titles are dropped.
- Must have a US location signal after normalization.
- Reject false positives like `Internal Audit` unless a real intern signal exists.

Adapters should prefer US-scoped ATS queries when the API supports it.

## ByteDance and TikTok

Two Discover companies share one supplier API (`jobs.bytedance.com`) via `lib/scraping/adapters/bytedance.ts`:

| Company slug | Careers surface | Posting URLs | Scope |
| --- | --- | --- | --- |
| `bytedance` | [jobs.bytedance.com](https://jobs.bytedance.com/en/position) | `jobs.bytedance.com/.../detail` | All US engineering internships from default intern keywords |
| `tiktok` | [lifeattiktok.com](https://lifeattiktok.com/early-careers) | `lifeattiktok.com/search/{id}` | TikTok / TikTok Shop (and related) roles only; excludes PICO-only, CapCut-only, etc. |

TikTok uses TikTok-focused search keywords. Roles listed on lifeattiktok but missing from supplier search are merged from `lib/scraping/adapters/lifeattiktok.ts` (IDs in `TIKTOK_SUPPLIER_SEARCH_GAP_JOB_IDS` or after `|` in `board_token`).

## Adapter quality checklist

When touching an adapter, wire every trustworthy ATS field:

| Field | Helpers |
| --- | --- |
| Intern filter | `classifyScrapeRole()` — pass `employmentType`, `commitment`, `departments`, `description`, all location segments |
| Season | `inferSeason(title, description, hints)` — title, description, and GH metadata season/duration |
| Posted date | `dates` via `lib/scraping/posted-date.ts` — prefer publish-class (`ats_publish`, `relative_parse`); never treat `updated_at` alone as Posted |
| Location | `formatClassifiedScrapeLocation()` after classification — US trim is applied in `classifyScrapeRole` |

Shared modules:

- `lib/scraping/greenhouse-board.ts` — Greenhouse `first_published`, employment metadata (coinbase, jane_street, greenhouse, …)
- `lib/scraping/scraped-role-build.ts` — `buildScrapedRole()` after a successful classification (preferred over hand-built role rows)
- `lib/scraping/role-parse-result.ts` — `buildRoleParseResult()` + dedupe; attaches date-quality stats for audits
- `lib/scraping/ats-postal-address.ts` — Ashby-style `postalAddress` → US location labels
- `lib/scraping/adapter-parse.ts` — `appendClassifiedRole()` / `finishAdapterParse()` helpers
- `lib/scraping/posted-date.ts` — `parseFlexiblePostedDate()`, `sitemapLastmodPublishDate()` for sitemap/HTML feeds
- `lib/scraping/location.ts` — `extractLocationsFromPlainText()` for HTML-only boards (Valve, Surge)
- `lib/scraping/season.ts` — season inference

Most adapters now use `buildScrapedRole()` + `buildRoleParseResult()` so US location trim and date stats stay consistent. Run `npm run scrape:audit-adapters` to find stragglers (thin Greenhouse wrappers, `nvidia`/`slack` Workday delegates).

**Ashby public API** (`api.ashbyhq.com/posting-api/job-board/{token}`): use `descriptionPlain`, `publishedAt`, `address.postalAddress`, `employmentType`, `workplaceType`, `isListed`; skip `isListed === false`.

**Audit all enabled sources (dry-run, no writes):**

```bash
npm run scrape:audit
npm run scrape:audit -- amazon
npm run scrape:audit-adapters   # static: buildScrapedRole / hand-built role rows per adapter
```

Flags companies where fewer than half of kept roles have publish-class dates (`pubDt` column).

## Probing a board (before onboarding)

```bash
node --disable-warning=ExperimentalWarning --experimental-strip-types \
  --experimental-specifier-resolution=node scripts/probe-discover-boards.ts
```

Or hit public APIs directly (Greenhouse/Ashby/Lever) — see `.cursor/skills/discover-queue/SKILL.md` Step 2.

## Onboarding a new company

1. **Check catalog:** `npm run discover-queue -- catalog-check --slug <slug>`
2. **Queue (optional):** add to `discover-queue/inbox.json` → `npm run discover-queue -- import`
3. **Pick industry** — set `companies.industry` to a valid `discover_industries.slug` (see [discover-industries.md](./discover-industries.md)); default `enterprise-software`
4. **Apply SQL** via Supabase `apply_migration` (`companies` + `company_sources`, and check constraint if new `source_type`)
5. **Verify:** `production_integrity_check()`, `npm run scrape -- --dry-run --verbose <slug>`, then live scrape
6. **Custom adapter** when standard ATS probes fail — do not fail the queue item only because Greenhouse/Ashby/Lever/Workday failed

Bulk worker instructions: [discover-queue/README.md](../discover-queue/README.md).

## Tesla note

Use `source_type` `tesla` and `tesla.com` careers APIs — not `tesla.wd1.myworkdayjobs.com` (maintenance redirect / CXS 422). Cron IPs may hit Akamai rate limits; adapter retries `429` only.

## Posted dates

Scrapers emit structured `dates` in `lib/scraping/posted-date.ts`; upsert merge in `lib/scraping/upsert.ts`. UI rules: [scraped-posted-dates.md](./scraped-posted-dates.md).

## Debugging

```bash
npm run scrape -- --dry-run --verbose <slug>
npm run scrape:audit
npm run test:unit
```

Inspect DB:

```sql
select c.slug, cs.source_type, cs.enabled, cs.last_success_at, cs.last_failure_at
from companies c
join company_sources cs on cs.company_id = c.id
where c.slug = '<slug>';

select count(*) from scraped_postings p
join companies c on c.id = p.company_id
where c.slug = '<slug>' and p.status = 'open';
```
