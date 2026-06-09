# Scraping and Discover catalog

Pathway ingests internship postings from employer ATS boards into `scraped_postings`. **Openings** and **Companies** read that store; they never scrape in the browser.

## Commands

```bash
# All enabled companies (parallel, default concurrency 8)
npm run scrape

# Send instant alerts for newly scraped matching roles
npm run alerts:instant

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
| `SCRAPE_EXCLUDE_SLUGS` | Optional comma-separated company slugs to skip in a scheduled environment |

Cron (production): `.github/workflows/scrape-and-alerts.yml` runs every 6 hours (`7 */6 * * *`, UTC). It runs `npm run scrape`, then `npm run alerts:instant`, using GitHub repository secrets. The workflow sets `SCRAPE_EXCLUDE_SLUGS=wayfair` because Wayfair rate-limits GitHub-hosted runner IPs with `429`; manual/local scrapes can still run `npm run scrape -- wayfair`. The `/api/cron/*` routes remain available for authenticated manual calls but are not scheduled in production.

## Location normalization

Scrape writes canonical locations via `lib/geo/`:

1. **Sanitize** messy ATS strings (Workday descriptors, office prefixes, country-first order).
2. **Gazetteer** lookup (GeoNames `cities15000` subset in `lib/geo/data/cities.json`).
3. **Structured adapter fields** when available (Workday `alpha2Code`, Ashby postal address, Oracle primary + country).
4. Persist `location` (display), `location_places` (jsonb), `countries`, and `location_confidence` on `scraped_postings`.

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
    → buildScrapeAdapter() in lib/scraping/registry.ts
    → adapter.fetchRoles()
    → classify (intern + engineering + US)
    → lib/scraping/upsert.ts → scraped_postings
```

Health columns on `company_sources`: `last_success_at`, `last_failure_at`.

## Source types

Canonical list: `SOURCE_TYPES` / `SourceType` in `lib/scraping/types.ts`. Registration is the typed `ADAPTER_FACTORIES` map in `lib/scraping/registry.ts`; `satisfies Record<SourceType, AdapterFactory>` makes a missing adapter a TypeScript error.

**Generic ATS (often only need DB rows + standard adapter):**

- `greenhouse`, `ashby`, `lever`, `workday`
- `workable`, `hiringthing`, `surge`, `smartrecruiters`, `jobvite`, `breezy`, `pinpoint`

**Custom adapters (employer-specific APIs or HTML):** include `google`, `microsoft`, `amazon`, `meta`, `apple`, `tesla`, `jane_street`, `hudson_river_trading`, `uber`, `salesforce`, `linkedin`, `oracle`, `goldman_sachs`, `jpmorgan_chase`, and others in the registry — copy an existing file under `lib/scraping/adapters/` when adding a new employer.

**Workday with shared-board filtering** (`splunk`, `juniper_networks`, `vmware`) scrape a parent company's Workday tenant with brand-scoped search. **Dedicated Workday boards** (including NVIDIA and RTX) use `source_type: workday` with the canonical `myworkdayjobs.com` URL; legacy marketing URLs are normalized via `lib/scraping/adapters/nvidia.ts` and `rtx.ts` during onboarding only.

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

Rules (biased toward keeping real interns):

- Title/metadata/description intern signals (`intern`, `co-op`, `university`, etc.). `early career` alone is **not** enough (often full-time new grad).
- Must match engineering scope; non-engineering intern titles are dropped.
- Must have a recognizable location after normalization (any country).
- Reject false positives like `Internal Audit` unless a real intern signal exists.

Adapters may still use region-scoped ATS queries when that reduces noise, but non-US locations are kept when returned.

## ByteDance and TikTok

Two catalog companies share one supplier API (`jobs.bytedance.com`) via `lib/scraping/adapters/bytedance.ts`:

| Company slug | Careers surface | Posting URLs | Scope |
| --- | --- | --- | --- |
| `bytedance` | [joinbytedance.com](https://joinbytedance.com) | `joinbytedance.com/search/{id}` | All US engineering internships from default intern keywords |
| `tiktok` | [lifeattiktok.com](https://lifeattiktok.com/early-careers) | `lifeattiktok.com/search/{id}` | TikTok / TikTok Shop (and related) roles only; excludes PICO-only, CapCut-only, etc. |

TikTok uses TikTok-focused search keywords. Roles listed on lifeattiktok but missing from supplier search are merged from `lib/scraping/adapters/lifeattiktok.ts` (IDs in `TIKTOK_SUPPLIER_SEARCH_GAP_JOB_IDS` or after `|` in `board_token`). ByteDance/TikTok supplier search currently exposes accurate locations but not trustworthy publish dates; detail-page date enrichment is opt-in with `SCRAPE_BYTEDANCE_DETAIL_DATES=1` because the public pages usually do not expose `datePosted`.

## Adapter quality checklist

When touching an adapter, wire every trustworthy ATS field:

| Field | Helpers |
| --- | --- |
| Intern filter | `classifyScrapeRole()` — pass `employmentType`, `commitment`, `departments`, `description`, all location segments |
| Season | `inferSeason(title, description, hints)` — title, description, and GH metadata season/duration |
| Posted date | `first_seen_at` from `lib/scraping/upsert.ts` — Pathway's first scrape time is the user-facing posted date |
| Location | `formatClassifiedScrapeLocation()` after classification — US trim is applied in `classifyScrapeRole` |

Shared modules:

- `lib/scraping/greenhouse-board.ts` — Greenhouse `first_published`, employment metadata (coinbase, jane_street, greenhouse, …)
- `lib/scraping/scraped-role-build.ts` — `buildScrapedRole()` after a successful classification (preferred over hand-built role rows)
- `lib/scraping/role-parse-result.ts` — `buildRoleParseResult()` + dedupe; attaches date-quality stats for audits
- `lib/scraping/ats-postal-address.ts` — Ashby-style `postalAddress` → US location labels
- `lib/scraping/adapter-parse.ts` — `appendClassifiedRole()` / `finishAdapterParse()` helpers
- `lib/scraping/location.ts` — `extractLocationsFromPlainText()` for HTML-only boards (Valve, Surge)
- `lib/scraping/season.ts` — season inference

Parser adapters use `buildScrapedRole()` + `buildRoleParseResult()` so US location trim and date stats stay consistent. Run `npm run scrape:audit-adapters` to verify; delegated wrappers are labeled separately from parser adapters.

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

The command validates the registered `source_type`, validates the industry slug against hosted Supabase, upserts `companies`, upserts one `company_sources` row, defaults `scrape_interval_minutes` to 15, and never clears existing optional company fields unless you provide replacements. Use `--logo-asset-key <slug>` after adding `public/company-logos/<slug>.png`.

Workflow:

1. **Check catalog:** `npm run discover-queue -- catalog-check --slug <slug>`
2. **Probe source:** use the standard ATS URL/API or add a custom adapter when Greenhouse/Ashby/Lever/Workday probes fail.
3. **Dry-run plan:** `npm run discover-company -- <flags>` and verify source/industry/logos.
4. **Apply + verify:** repeat the same command with `--apply --scrape`, then `npm run scrape -- --dry-run --verbose <slug>`.
5. **Database safety:** run `production_integrity_check()` after durable schema/RLS changes or new `source_type` migrations. Routine company/source onboarding via `discover-company` does not need a migration file.

Bulk worker instructions remain available for large batches: [discover-queue/README.md](../discover-queue/README.md).

## Tesla note

Use `source_type` `tesla` and `tesla.com` careers APIs — not `tesla.wd1.myworkdayjobs.com` (maintenance redirect / CXS 422). Cron IPs may hit Akamai rate limits; adapter retries `429` only. As of hosted migration `triage_failing_discover_sources` (2026-06-02), the Tesla source is disabled until a collection path that avoids persistent 429s is implemented.

## Posted dates

Scrapers do not persist ATS publish-date fields. `lib/scraping/upsert.ts` preserves `first_seen_at` for existing posting URLs and initializes it for new URLs. UI rules: [scraped-posted-dates.md](./scraped-posted-dates.md).

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
