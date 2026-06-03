# Scraped posting dates

Pathway stores employer publish estimates in `scraped_postings` with explicit provenance. The UI only shows **Posted** when the source and confidence support it; otherwise users see **Discovered** (Pathway `first_seen_at`).

## Columns

| Column | Meaning |
|--------|---------|
| `date_posted` | Best employer publish estimate (earliest publish-class value after merge) |
| `date_modified` | ATS last-touch time (never labeled "Posted") |
| `date_posted_source` | `ats_publish`, `ats_modified`, `page`, `sitemap`, `relative_parse`, `inferred`, `unknown` |
| `date_posted_confidence` | `high`, `medium`, `low`, `unknown` |
| `date_posted_raw` | Optional raw string (e.g. Workday "Posted 3 days ago") |
| `first_seen_at` | When Pathway first indexed the URL (Live **NEW** badge) |

## Merge policy

Implemented in [`lib/scraping/posted-date.ts`](../lib/scraping/posted-date.ts) and applied on upsert in [`lib/scraping/upsert.ts`](../lib/scraping/upsert.ts):

- Publish-class incoming dates use **earliest** of existing and new (never move forward on cron).
- `ats_modified` / sitemap never overwrite a publish estimate.
- Null incoming preserves existing values.
- Legacy rows backfilled to `ats_modified` / `sitemap` clear `date_posted` on the next merge so they are not shown as Posted.

## Display

[`lib/feed/posted-display.ts`](../lib/feed/posted-display.ts):

- **Posted** — `ats_publish` / `page` / `relative_parse` with `high` or `medium` confidence.
- **Discovered** — fallback to `first_seen_at`.
- Live **NEW** — `first_seen_at` vs `user_preferences.live_last_seen_at` (not employer publish date). Old browser-storage visit keys are imported once and then cleared.

## Adapter tiers (maintenance)

### Tier 0 — modified / sitemap (do not show Posted)

| Adapter | Field used | `dates` helper |
|---------|------------|----------------|
| citadel | sitemap `lastmod` | `sitemapScrapedDates` |
| jane_street, coinbase | `updated_at` | `atsModifiedOnly` |
| atlassian, lockheed_martin | `updatedDate` / `lastUpdated` | `atsModifiedOnly` |

### Tier 1 — publish-class (typical)

| Adapter | Field | Notes |
|---------|-------|-------|
| greenhouse | `first_published`, metadata publish | `greenhouseRoleDates` |
| lever | `createdAt` | `atsPublishDate` |
| ashby | `publishedAt` / `publishedDate`, else `updatedAt` | `atsPublishWithModified` |
| workday | relative `postedOn` | `relativeParseDate` + raw |
| smartrecruiters | `releasedDate` | |
| uber, wayfair | creation vs updated | `atsPublishWithModified` |
| Most JSON/list adapters | `postedDate`, `pubDate`, etc. | `atsPublishDate` |

### Unknown publish (no employer publish field in API/HTML)

| Adapter | Notes |
|---------|--------|
| **ByteDance** (`bytedance`), **TikTok** (`tiktok`) | Shared supplier API; public search exposes title/location only; `job_post_info.expiry_time` is usually null. Detail pages are client-rendered without `datePosted` in static HTML. TikTok may also ingest from lifeattiktok HTML when a role is absent from search. |
| **Lockheed Martin** | BrassRing exposes `lastupdated` only → `atsModifiedOnly` (Discovered in UI). |
| **Citadel** | Yoast sitemap `lastmod` → `sitemapScrapedDates` (not Posted). |
| Tesla, Valve, Surge | No reliable publish field yet. |

### Avature detail enrichment

IBM, Two Sigma, Citi, L3Harris, Bloomberg (list-only dates) use [`lib/scraping/avature-dates.ts`](../lib/scraping/avature-dates.ts): JSON-LD `datePosted`, Avature sidebar **job-date**, and `article:published_time` meta when present on JobDetail HTML.

## Verification

```bash
npm run test:unit
# After scrape with service role (positional company slug, or omit for all):
npm run scrape -- <company>
```

Columns `date_posted_source`, `date_posted_confidence`, and related fields exist on `scraped_postings` in production; legacy rows are normalized on the next scrape merge.
