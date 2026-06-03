# Email Alerts (Resend)

**Date:** 2026-06-01  
**Status:** Historical (superseded)

> Current production alerts support `company` and curated `sector` subscriptions only. Legacy `industry`
> alert subscriptions were removed by the `remove_industry_alert_subscriptions` migration, and the old
> public alert write RPCs were dropped by `drop_legacy_alert_write_rpcs`. See
> [docs/architecture.md](../../architecture.md) and [supabase/README.md](../../../supabase/README.md)
> for current behavior.

## Goal

Add an **Alerts** page where users opt in to email notifications for new internships at specific companies or in specific Discover industries. Delivery supports **instant** (after scheduled scrape) and **daily digest** (14:11 UTC). Powered by Resend.

## Product behavior

### Opt-in

- Master **Email alerts** switch defaults **off**.
- No emails send until the switch is on **and** at least one subscription exists.
- Email address is the signup email address (read-only on Alerts page).

### Subscriptions

- **Companies** — pick from Discover catalog (`companies` table).
- **Industries** — pick from `discover_industries` taxonomy.
- Each subscription has its own cadence: `instant` or `digest`.
- One row per target (`user_id`, `target_type`, `target_id` unique).
- **Independent** from Discover starred companies (`discover_company_favorites`).

### Delivery

| Cadence | Trigger |
| --- | --- |
| **Instant** | After scheduled scrape cron (`/api/cron/scrape-postings`) |
| **Digest** | Daily cron at **14:11 UTC** |

### What counts as “new”

- Postings whose `first_seen_at` is set on first scrape (same semantics as Live **NEW** badge).
- **US-only** — same location filter as Live/Discover feeds.

### Email content

- **Instant:** single role — company, role title, season/location, link to posting URL, link to `/alerts`, signed unsubscribe.
- **Digest:** grouped summary — “X new internships” with up to 20 roles, grouped by company, link to `/live`, link to `/alerts`, signed unsubscribe.

## Data model

All tables RLS-scoped to `auth.uid()` for user reads/writes. Cron uses service role.

### `alert_preferences`

| Column | Type | Notes |
| --- | --- | --- |
| `user_id` | uuid PK | FK → `auth.users` |
| `emails_enabled` | boolean | default `false` |
| `updated_at` | timestamptz | |

### `alert_subscriptions`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | default `gen_random_uuid()` |
| `user_id` | uuid | FK → `auth.users` |
| `target_type` | text | `'company'` \| `'industry'` |
| `target_id` | text | `companies.id` (uuid as text) or `discover_industries.slug` |
| `cadence` | text | `'instant'` \| `'digest'` |
| `created_at` | timestamptz | default `now()` |

Unique: `(user_id, target_type, target_id)`.

Check constraints on `target_type` and `cadence`.

### `alert_sent_postings` (dedup ledger)

| Column | Type | Notes |
| --- | --- | --- |
| `user_id` | uuid | |
| `posting_id` | uuid | FK → `scraped_postings.id` |
| `channel` | text | `'instant'` \| `'digest'` |
| `sent_at` | timestamptz | default `now()` |

Unique: `(user_id, posting_id, channel)`.

### `alert_digest_state`

| Column | Type | Notes |
| --- | --- | --- |
| `user_id` | uuid PK | |
| `last_sent_at` | timestamptz | window start for next digest |

## Architecture

```
Hourly: /api/cron/scrape-postings
  └─ runAllScrapes()
  └─ processInstantAlerts()     (service role, lib/alerts/send-instant.ts)

Daily: /api/cron/send-alert-digests  (14:11 UTC)
  └─ processDigestAlerts()      (service role, lib/alerts/send-digest.ts)
```

### Matching logic (`lib/alerts/match-postings.ts`)

Pure functions, unit tested:

- Given postings + user subscriptions → matched pairs.
- Company match: posting's `company_id` equals subscription `target_id`.
- Industry match: posting's company's `industry` slug equals subscription `target_id`.
- Filter: user has `emails_enabled = true`, cadence matches channel, not already in `alert_sent_postings`.

### Resend (`lib/email/`)

Env vars:

```bash
RESEND_API_KEY=...
RESEND_FROM_EMAIL=Pathway Alerts <alerts@yourdomain.com>
ALERT_UNSUBSCRIBE_SECRET=...   # HMAC signing for unsubscribe tokens
```

- `lib/email/resend-client.ts` — thin Resend wrapper (fetch API, no SDK required for v1).
- `lib/email/templates/instant-alert.ts` — HTML for instant emails.
- `lib/email/templates/digest-alert.ts` — HTML for digest emails.
- `lib/alerts/unsubscribe-token.ts` — sign/verify tokens; `/alerts/unsubscribe` route disables all alerts.

## UI

### Nav

- Route: `/alerts`
- Icon: `Mail` from `lucide-react`, placed before Settings in `components/sidebar.tsx`.
- Add to `lib/config/nav.ts` `NAV_HREFS`.

### Page sections (`components/alerts-page.tsx`)

1. Header — title + description
2. Master switch — Email alerts
3. Your email — read-only
4. Companies — search/add from catalog; per-row cadence toggle + remove
5. Industries — catalog chips; per-row cadence toggle + remove
6. Empty states

Patterns: `PageShell`, `PageSection`, `Switch`, `SearchInput`, `FilterChip` (same as Discover/Settings).

### Server actions (`lib/actions/alerts.ts`)

- `updateAlertsEnabled(enabled)`
- `addAlertSubscription(targetType, targetId, cadence)`
- `updateAlertSubscriptionCadence(id, cadence)`
- `removeAlertSubscription(id)`
- `unsubscribeAlerts(token)` — public action for email link

## Out of scope (v1)

- Discover favorites sync
- Per-user timezone
- Weekly digest
- In-app/push notifications
- Application timeline alerts

## Verification

- `tests/unit/alert-match-postings.test.ts`
- `tests/unit/alert-unsubscribe-token.test.ts`
- `npm run verify`
- Migration applied + `production_integrity_check()` → every returned `violations` value is `0`
- Manual: Resend test send with `RESEND_API_KEY`

## Docs updates

- `docs/architecture.md` — route, tables, cron
- `docs/production-runbook.md` — Resend env vars, domain verification
