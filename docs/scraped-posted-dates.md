# Scraped posting dates

Pathway's user-facing **Posted** date is `posted_at`: the time we first found a logical role or the time we detected it was republished for a new season. `first_seen_at` remains provenance for when Pathway first indexed the logical role; older rows may reflect trustworthy legacy ATS publish data from `date_posted`.

## Columns

| Column | Meaning |
|--------|---------|
| `first_seen_at` | When Pathway first indexed the logical role, or trustworthy legacy ATS publish data for older backfilled rows |
| `posted_at` | User-facing posted/reposted time; used for sort, display, alerts, and NEW badge |
| `last_seen_at` | Updated each scrape while open; set when status → `closed` |
| `created_at` | Row creation timestamp |
| `updated_at` | Row update timestamp |

## Upsert policy

Implemented in [`lib/scraping/upsert.ts`](../lib/scraping/upsert.ts):

- **New posting URL:** `first_seen_at = now`, `posted_at = now`.
- **Existing row:** `first_seen_at` is preserved.
- **Same logical role with a moved URL:** if the current scrape has exactly one active same-title predecessor for the company, the scraper updates the predecessor row to the new canonical URL and preserves its `first_seen_at` / `posted_at`.
- **Routine rescrape:** `posted_at` is preserved even if the ATS exposes a newer generic `updatedAt` or the title text changes.
- **Republished row:** `posted_at` advances only when an existing URL changes from one explicit season to another, with the previous season explicitly present in the stored title and the next season explicitly present in the current title or description. Inferred/default seasons do not move `posted_at`. If a real season change includes a trustworthy, meaningfully newer ATS `updatedAt`, `posted_at` uses that timestamp; otherwise it uses the scrape time.
- **Reused old ATS ID:** if the current scrape has an explicit season/year and the stored date is before January 1 of the previous calendar year, a trustworthy ATS `updatedAt` can advance `posted_at`. This covers boards that keep the same job ID but rewrite the posting for a new recruiting cycle.
- **Every scrape:** `last_seen_at = now` for observed open rows.
- **Alert dedup:** republished rows clear prior `alert_sent_postings` ledger entries so matching users can be notified again.

## Legacy cleanup

Migration `backfill_first_seen_from_legacy_date_posted` copied legacy `date_posted` into `first_seen_at` for rows where `date_posted_source <> 'first_scraped'`. Migration `drop_legacy_scraped_posting_dates` then removed `date_posted`, `date_modified`, `date_posted_source`, `date_posted_confidence`, and `date_posted_raw`.

## Display

[`lib/feed/posted-display.ts`](../lib/feed/posted-display.ts):

- **Sort and relative time** — `posted_at`, falling back to `first_seen_at`.
- Openings **NEW** badge — `posted_at` vs `user_preferences.live_last_seen_at` (column name is legacy).

## Verification

```bash
npm run test:unit
npm run scrape -- <company-slug>
```

After scrape, genuinely new rows should have `first_seen_at ≈ posted_at ≈ last_seen_at`. Re-scraping an unchanged older row, a row whose ATS URL moved, or a row whose season changed only because of inference/defaulting must not change `first_seen_at` or `posted_at`; re-scraping a confirmed republished older row must preserve `first_seen_at` and advance `posted_at`.

For broad audits, run:

```bash
node --disable-warning=ExperimentalWarning --experimental-strip-types --experimental-specifier-resolution=node scripts/audit-posted-dates.ts
```
