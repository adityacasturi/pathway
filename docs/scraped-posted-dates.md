# Scraped posting dates

Pathway's user-facing **Posted** date is the time we first scraped a role (`first_seen_at`).

## Columns

| Column | Meaning |
|--------|---------|
| `first_seen_at` | Canonical posted time — when Pathway first indexed the URL; used for sort, display, alerts, and NEW badge |
| `last_seen_at` | Updated each scrape while open; set when status → `closed` |
| `created_at` | Row creation timestamp |
| `updated_at` | Row update timestamp |

## Upsert policy

Implemented in [`lib/scraping/upsert.ts`](../lib/scraping/upsert.ts):

- **New posting URL:** `first_seen_at = now`.
- **Existing row:** `first_seen_at` is preserved.
- **Every scrape:** `last_seen_at = now` for observed open rows.

## Legacy cleanup

Migration `backfill_first_seen_from_legacy_date_posted` copied legacy `date_posted` into `first_seen_at` for rows where `date_posted_source <> 'first_scraped'`. Migration `drop_legacy_scraped_posting_dates` then removed `date_posted`, `date_modified`, `date_posted_source`, `date_posted_confidence`, and `date_posted_raw`.

## Display

[`lib/feed/posted-display.ts`](../lib/feed/posted-display.ts):

- **Sort and relative time** — always `first_seen_at`.
- Openings **NEW** badge — `first_seen_at` vs `user_preferences.live_last_seen_at` (column name is legacy).

## Verification

```bash
npm run test:unit
npm run scrape -- <company-slug>
```

After scrape, new rows should have `first_seen_at ≈ last_seen_at`. Re-scraping an older row must not change its `first_seen_at`.
