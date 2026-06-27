# Scraping and Discover catalog

Pathway ingests internship postings from employer ATS boards into `scraped_postings`. **Openings** and **Companies** read that store; they never scrape in the browser.

## Commands

```bash
# All enabled companies (parallel, default concurrency 8)
npm run scrape

# Send instant alerts for newly scraped matching roles
npm run alerts:instant

# Send daily briefing (digest) emails
npm run alerts:digest

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
| `RESEND_API_KEY` | Required by `npm run alerts:instant` to send email |
| `RESEND_FROM_EMAIL` | Verified sender for alert email |
| `ALERT_UNSUBSCRIBE_SECRET` | Required to sign unsubscribe links |
| `SCRAPER_VERBOSE=1` | Same as `--verbose` |
| `SCRAPE_COMPANY_CONCURRENCY` | Parallel companies (default 8, max 16) |
| `SCRAPE_SHARD_INDEX` / `SCRAPE_SHARD_COUNT` | Deterministic subset for parallel scrape jobs (e.g. `0` / `5`) |

Cron (production): GitHub Actions in `.github/workflows/` — hourly **five parallel scrape shards** (`SCRAPE_SHARD_COUNT=5`, `SCRAPE_COMPANY_CONCURRENCY=16`) then one `npm run alerts:instant` (`7 * * * *` UTC), plus daily briefing via `npm run alerts:digest` (`0 13 * * *` UTC). Manual/local scrapes use the same `runAllScrapes` path: `npm run scrape -- <slug>` or `npm run scrape -- --shard 2/5`.

`company_sources.scrape_interval_minutes` (default 15 on onboard) is catalog metadata only — production cadence is the GitHub Actions scrape workflow, not that column.

## HTTP stack

Adapters use native `fetch` with retries and timeouts (`lib/scraping/adapters/shared.ts`). JSON ATS boards parse response bodies directly; HTML snippets go through `lib/scraping/plain-text.ts` and `lib/scraping/html-utils.ts`. There is no Crawlee/Playwright runtime in the scrape path — GitHub Actions and `npm run scrape` share the same adapter registry and upsert pipeline.

## Location normalization (global)

Scrape writes canonical locations via `lib/geo/`. Locations are resolved **once**, inside `buildScrapedRole()` — adapters and persistence never re-parse them.

1. **Sanitize** messy ATS strings (Workday descriptors, office prefixes, country-first order, postal codes, admin suffixes like "District").
2. **Gazetteer** lookup (GeoNames `cities15000` subset in `lib/geo/data/cities.json`, global).
3. **Structured adapter fields** when available (Workday `alpha2Code`, Ashby postal address, Oracle primary + country).
4. Persist `location` (display), `raw_location` (original ATS string, always), `location_places` (jsonb), `countries`, and `location_confidence` on `scraped_postings`.

Honesty rules:

- Any country worldwide is kept — there is no US-only trim.
- Ambiguous state-vs-country codes (`IL`, `IN`, `DE`, `CA`, …) require gazetteer corroboration ("Tel Aviv, IL" → Israel; "Chicago, IL" → US; "Foo, IL" → unknown). The same applies to Canadian-province collisions (`NL`, `SK`, `PE`, …): "Amsterdam, NL" → Netherlands.
- Unknown countries are **never** defaulted to the United States.
- When nothing resolves confidently, the role is still kept: `location` is null, `raw_location` preserves the source string, and the UI shows "Unknown".
- Multi-city lists ("London, NY, Miami") resolve to multiple places.

Commands:

```bash
npm run build:gazetteer      # dev: refresh cities.json from GeoNames
npm run backfill:locations     # re-normalize open rows
npm run scrape:audit-locations # quality summary + baseline
```

Geodata attribution: [GeoNames](https://www.geonames.org/) (CC-BY).

### Company logos (static)

```bash
npm run company-logos              # all active companies → public/company-logos/{slug}.png
npm run company-logos -- --slug acme
npm run company-logos -- --manifest-only   # rebuild lib/logo/static-slug-manifest.json from PNGs
```

Requires `LOGO_DEV_TOKEN`. After Discover onboarding, run per slug. The app serves static logos when the slug is listed in the manifest; otherwise it falls back to `/api/logo`. Static `/company-logos/*` responses carry long-lived browser cache headers and render with normal lazy/eager image loading, so navigating away and back should not refetch hundreds of PNGs.

## Pipeline

```text
company_sources (enabled)
    → runAllScrapes() in lib/scraping/run-all.ts     # GHA + npm run scrape
    → buildScrapeAdapter() in lib/scraping/registry.ts
    → adapter.fetchRoles()                          # fetch + extract only
    → classifyForSource()                           # central relevance decision (explainable)
    → buildScrapedRole()                            # location + season + role_type
    → resolvePostedAt() in lib/scraping/posted-at.ts  # posted_at / republish semantics
    → lib/scraping/upsert.ts                        # URL dedupe, stale-close, alert ledger
    → scraped_postings (+ scrape_runs summary per run)
```

Per-source outcomes: `ok` · `ok_no_roles` · `suspicious_zero` · `suspicious_drop` · `suspicious_filter` · `error`.

Source health uses trusted baselines on `company_sources`: `last_healthy_fetched_count`, `last_healthy_kept_count`, and `last_healthy_at`. Suspicious/error runs update only `last_attempted_*`, `scrape_health_status`, and `consecutive_unhealthy_runs`; they do not overwrite the healthy baseline. This keeps a broken source suspicious across repeated broken runs instead of resetting the comparison to zero.

Suspicious and error runs skip stale-close for that company. Absence is trusted only after a healthy scrape. Every non-dry run inserts a `scrape_runs` row (totals + `attention` list of failing/suspicious slugs):

```sql
select * from scrape_runs order by started_at desc limit 10;
```

## Source types

Canonical list: `SOURCE_TYPES` / `SourceType` in `lib/scraping/types.ts`. Registration is the typed `ADAPTER_FACTORIES` map in `lib/scraping/registry.ts`; `satisfies Record<SourceType, AdapterFactory>` makes a missing adapter a TypeScript error.

**Generic ATS (often only need DB rows + standard adapter):**

- `greenhouse`, `ashby`, `lever`, `workday`
- `workable`, `hiringthing`, `surge`, `smartrecruiters`, `jobvite`, `breezy`, `pinpoint`, `clearcompany`, `icims`

**Custom adapters (employer-specific APIs or HTML):** include `google`, `microsoft`, `amazon`, `meta`, `apple`, `tesla`, `jane_street`, `hudson_river_trading`, `uber`, `salesforce`, `linkedin`, `oracle`, `goldman_sachs`, `jpmorgan_chase`, and others in the registry — copy an existing file under `lib/scraping/adapters/` when adding a new employer.

**Workday with shared-board filtering** (`splunk`, `juniper_networks`, `vmware`) scrape a parent company's Workday tenant with brand-scoped search. **Dedicated Workday boards** (including NVIDIA and RTX) use `source_type: workday` with the canonical `myworkdayjobs.com` URL on the `company_sources` row.

**HiringThing redirects:** Voloridge is registered as `source_type: hiringthing`, but the adapter reads the current public careers page at `https://voloridge.com/join-our-team` because the old hosted HiringThing board URL no longer lists the visible internship roles.

**1X Technologies:** 1X moved from the stale Recruitee API to Ashby. As of hosted migration `fix_serious_scrape_source_health_20260621` (2026-06-21), the enabled source is `source_type: ashby` with board token `1x`.

**LinkedIn:** The public LinkedIn guest jobs search is unstable from scraper environments and can return inconsistent raw counts or zero-result pages. As of hosted migration `triage_teradata_and_linkedin_scrape_sources_20260621` (2026-06-21), the LinkedIn source is disabled until a stable replacement source is identified.

Adding a **new** `source_type` requires:

1. Adapter file + `ADAPTER_FACTORIES` entry in `registry.ts`
2. Extend `company_sources_source_type_check` in SQL (`apply_migration`)
3. Unit coverage in `tests/unit/adapter-parse.test.ts`, `tests/unit/scrape-classify.test.ts`, etc.; adapter HTML regressions via `npm run scrape:audit-adapters`

## Role filters

Shared logic:

- `lib/scraping/classify-role.ts` — intern signals + engineering scope
- `lib/feed/roles.ts` — engineering title patterns for Openings/Companies
- `lib/feed/location.ts` + `lib/feed/us-locations.ts` — country detection from location strings
- `lib/feed/country-filter.ts` — Openings and Applications country filters

Rules (`classifyScrapeRole` returns `include` + `roleType` + `reason` + `signals` for explainability):

- Positive signals: title intern/co-op/summer analyst/working student/etc. (strongest), employment-type/commitment metadata, early-talent team/departments, description-head program mentions (weakest).
- Negative signals veto weak (non-title) positives: seniority titles (`Senior`, `Staff`, `Principal`, `Manager`, …), leveled titles (`Engineer II/III`, `L5`), permanent employment metadata.
- `new grad` / `entry level` titles classify as `role_type = new_grad` and are excluded while `INCLUDE_NEW_GRAD_ROLES` is false in `lib/scraping/classify-role.ts`.
- Must match engineering scope; non-engineering intern titles are dropped.
- Location does **not** gate relevance — unparseable locations are stored as honest unknowns.
- False positives like `Internal Audit` are rejected unless a real student token exists.

Adapters may still use region-scoped ATS queries when that reduces noise, but all returned locations are kept worldwide.

## ByteDance and TikTok

Two catalog companies share one supplier API (`jobs.bytedance.com`) via `lib/scraping/adapters/bytedance.ts`:

| Company slug | Careers surface | Posting URLs | Scope |
| --- | --- | --- | --- |
| `tiktok` | [lifeattiktok.com](https://lifeattiktok.com/early-careers) | `lifeattiktok.com/search/{id}` when that page is live, else `joinbytedance.com/search/{id}` | TikTok / TikTok Shop (and related) roles only; excludes PICO-only, CapCut-only, etc. |
| `bytedance` | [joinbytedance.com](https://joinbytedance.com) | `joinbytedance.com/search/{id}` | All US engineering internships from default intern keywords |

TikTok uses TikTok-focused search keywords. Roles listed on lifeattiktok but missing from supplier search are merged from `lib/scraping/adapters/lifeattiktok.ts` (IDs in `TIKTOK_SUPPLIER_SEARCH_GAP_JOB_IDS` or after `|` in `board_token`). ByteDance/TikTok supplier search currently exposes accurate locations but not trustworthy publish dates; detail-page date enrichment is opt-in with `SCRAPE_BYTEDANCE_DETAIL_DATES=1` because the public pages usually do not expose `datePosted`. Both brands share the same supplier API; posting URLs use each brand’s public `/search/{id}` detail page. Most TikTok intern roles only render on `joinbytedance.com` even though they are TikTok-team jobs — the TikTok adapter probes `lifeattiktok.com/search/{id}` first and falls back to `joinbytedance.com/search/{id}` when the TikTok page 404s. When ATS publish dates are unavailable, `estimateByteDanceJobPostedAt()` calibrates snowflake job IDs against repo-sourced anchor dates instead of clumping at index time.

## Adapter quality checklist

When touching an adapter, wire every trustworthy ATS field:

| Field | Helpers |
| --- | --- |
| Intern filter | `classifyScrapeRole()` — pass `employmentType`, `commitment`, `departments`, `description`, all location segments |
| Season | `inferSeason(title, description, hints)` — defaults to `Summer` when no season is stated |
| Posted date | `posted_at` from `lib/scraping/upsert.ts` — Pathway's user-facing posted/reposted time; adapters should pass trustworthy ATS dates via `atsDates` |
| Location | resolved once in `buildScrapedRole()` from the classification's raw inputs — adapters never format locations |

Shared modules:

- `lib/scraping/greenhouse-board.ts` — Greenhouse `first_published`, employment metadata (coinbase, jane_street, greenhouse, …)
- `lib/scraping/scraped-role-build.ts` — `buildScrapedRole()` after a successful classification (preferred over hand-built role rows)
- `lib/scraping/role-parse-result.ts` — `buildRoleParseResult()` + dedupe; attaches date-quality stats for audits
- `lib/scraping/ats-postal-address.ts` — Ashby-style `postalAddress` → US location labels
- `lib/scraping/adapter-parse.ts` — `appendClassifiedRole()` / `finishAdapterParse()` helpers
- `lib/scraping/location.ts` — `extractLocationsFromPlainText()` for HTML-only boards (Valve, Surge)
- `lib/scraping/season.ts` — season inference

Parser adapters use `buildScrapedRole()` + `buildRoleParseResult()` so location resolution, dedupe, and stats stay consistent. Run `npm run scrape:audit-adapters` to verify; delegated wrappers are labeled separately from parser adapters.

**Ashby public API** (`api.ashbyhq.com/posting-api/job-board/{token}`): use `descriptionPlain`, `publishedAt`, `updatedAt` when present, `address.postalAddress`, `employmentType`, `workplaceType`, `isListed`; skip `isListed === false`. When `updatedAt` is missing from the API payload, kept roles may fetch the public job page and parse `window.__appData.posting.updatedAt` for republish detection.

**Audit all enabled sources (dry-run, no writes):**

```bash
npm run scrape:audit
npm run scrape:audit -- amazon
npm run scrape:audit-adapters   # static: buildScrapedRole / hand-built role rows per adapter
```

`npm run scrape:audit` is intentionally sequential by default so validation failures map to a
specific adapter/source instead of production-concurrency network pressure. Set
`SCRAPE_AUDIT_COMPANY_CONCURRENCY=<n>` only when you explicitly want a faster but noisier audit run.

Flags companies where fewer than half of kept roles have publish-class dates (`pubDt` column).

## Probing a board (before onboarding)

```bash
node --disable-warning=ExperimentalWarning --experimental-strip-types \
  --experimental-specifier-resolution=node scripts/probe-discover-boards.ts
```

Or hit public APIs directly (Greenhouse/Ashby/Lever) — see `.cursor/skills/discover-queue/SKILL.md` Step 2.

## Onboarding a new company

For one-off onboarding, prefer the direct hosted-Supabase CLI:

```bash
npm run discover-company -- \
  --slug acme \
  --name "Acme" \
  --website https://acme.example \
  --careers https://acme.example/careers \
  --industry enterprise-software \
  --source-type greenhouse \
  --source-url https://job-boards.greenhouse.io/acme \
  --board-token acme

# Review the JSON dry-run, then repeat with --apply --scrape:
npm run discover-company -- \
  --slug acme \
  --name "Acme" \
  --website https://acme.example \
  --careers https://acme.example/careers \
  --industry enterprise-software \
  --source-type greenhouse \
  --source-url https://job-boards.greenhouse.io/acme \
  --board-token acme \
  --apply \
  --scrape
```

The command validates the registered `source_type`, validates the industry slug against hosted Supabase, upserts `companies`, upserts one `company_sources` row (with `scrape_interval_minutes` default 15 as catalog metadata), and never clears existing optional company fields unless you provide replacements. Use `--logo-asset-key <slug>` after adding `public/company-logos/<slug>.png`.

Workflow:

1. **Check catalog:** `npm run discover-queue -- catalog-check --slug <slug>`
2. **Probe source:** use the standard ATS URL/API or add a custom adapter when Greenhouse/Ashby/Lever/Workday probes fail.
3. **Dry-run plan:** `npm run discover-company -- <flags>` and verify source/industry/logos.
4. **Apply + verify:** repeat the same command with `--apply --scrape`, then `npm run scrape -- --dry-run --verbose <slug>`.
5. **Database safety:** run `production_integrity_check()` after durable schema/RLS changes or new `source_type` migrations. Routine company/source onboarding via `discover-company` does not need a migration file.

Bulk worker instructions remain available for large batches: [discover-queue/README.md](../discover-queue/README.md).

## Tesla note

Use `source_type` `tesla` and the public careers state snapshot at
`https://www.tesla.com/cua-api/apps/careers/state`. The payload contains global
`lookup` maps and compact `listings`; posting URLs are derived as
`https://www.tesla.com/careers/search/job/<slug>-<id>` when no explicit URL is
present. Do not use `tesla.wd1.myworkdayjobs.com`: the Workday CXS path returns
`422`, and the tenant page returns a Workday application error.

Tesla's Akamai edge can block scraper/serverless egress with `403 Access Denied`
before application code runs. The adapter fetches the state snapshot directly
and reports that condition explicitly. If production/Vercel egress is blocked,
run the Tesla fetch from an allowed egress path or ingest a cached state
snapshot from one.

## ASML note

Use `source_type` `asml` with `source_url` `https://www.asml.com/en/careers/find-your-job`.
ASML's public Workday tenant (`asml.wd1.myworkdayjobs.com`) returns `422`/`500` for
CXS and the careers page; the adapter instead reads `/api/job-posting-sitemap` and
fetches each job detail page's embedded `__NEXT_DATA__.props.pageProps.jobData`.

## Posted dates

Scrapers pass trustworthy ATS publish/update fields through `ScrapedRole.atsDates` when available. `lib/scraping/upsert.ts` preserves `first_seen_at`, stores user-facing `posted_at`, and advances `posted_at` only when an existing posting changes from one explicit season to another. The previous season must be explicit in the stored title, and the next season must be explicit in the current title or description; inferred/default seasons are not republish evidence. Same-title URL moves for an active company row update the existing row's canonical URL and preserve its dates. Generic ATS `updatedAt` changes, title-only churn, and URL-shape churn do not make old rows look newly posted, except for reused ATS IDs where the current scrape has an explicit season/year and the stored date is implausibly old for that program year. UI rules and the broad audit command: [scraped-posted-dates.md](./scraped-posted-dates.md).

Known live-source limitations from the 2026-06-02 dry-run audit:

- ByteDance/TikTok supplier search exposes locations and role detail text, but no trustworthy publish field. Detail-page date fetching is opt-in and still usually finds no `datePosted`.
- IBM's accessible Avature list/detail pages currently expose valid locations but no publish field for kept US internship/apprentice roles.
- Electronic Arts Avature RSS can provide `pubDate` for overlapping listings, and the adapter now merges it into HTML results. The current kept EA internship detail page itself exposes no trustworthy publish field.

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
