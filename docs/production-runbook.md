# Production runbook

## Pre-deploy checklist

- [ ] Node.js 22.x on Vercel
- [ ] `npm run test:preprod:full` green (lint, typecheck, audit, unit, build, public e2e)
- [ ] New DB changes present in Supabase `list_migrations` (not ad-hoc SQL only)
- [ ] `select * from app_private.production_integrity_check();` → every returned `violations` value is **0**
- [ ] Supabase security/performance advisors reviewed
- [ ] Production env vars set (see below)

## Database changes

1. `apply_migration` (MCP or CLI) with a descriptive name.
2. Confirm `list_migrations`.
3. `select * from app_private.production_integrity_check();` → every returned `violations` value is `0`.
4. Run advisors; document accepted warnings.
5. Optional: commit SQL under `supabase/migrations/` for review-worthy schema/RLS only.

Details: [supabase/README.md](../supabase/README.md). Do not replay `supabase/migrations_archive/`.

Emergency SQL in the dashboard must be followed by `apply_migration` if the change is durable.

## Environment variables

**Required (production):**

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_SITE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...   # server/cron only — never NEXT_PUBLIC_
RESEND_API_KEY=...              # Email alerts (Resend)
RESEND_FROM_EMAIL=...           # Verified sender, e.g. Pathway Alerts <alerts@yourdomain.com>
ALERT_UNSUBSCRIBE_SECRET=...    # Random secret for signed unsubscribe tokens
CRON_SECRET=...                 # Vercel Cron auth (Bearer token for /api/cron/*)
```

**Alerts email delivery:** requires `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `ALERT_UNSUBSCRIBE_SECRET`. The instant-alert script skips outbound email when Resend is not configured.

**Vercel Cron (scrape + instant alerts):**

Production scraping and instant alerts are scheduled in `vercel.json`. Vercel sends `Authorization: Bearer $CRON_SECRET` on each invocation.

**Hobby plan (current):** each cron expression may run at most once per day. Sub-hourly schedules such as `7 */6 * * *` fail deployment. Pathway uses four daily windows (00:07, 06:07, 12:07, 18:07 UTC) with two scrape shards per window and instant alerts 30 minutes later:

| Window (UTC) | Scrape shards | Instant alerts |
| --- | --- | --- |
| `7 0 * * *` | `shard=0&shards=2`, `shard=1&shards=2` | `37 0 * * *` |
| `7 6 * * *` | same | `37 6 * * *` |
| `7 12 * * *` | same | `37 12 * * *` |
| `7 18 * * *` | same | `37 18 * * *` |

Hobby timing is hourly-precision (±59 min within the scheduled hour).

**Pro plan:** you can switch to five crons with `7 */6 * * *` (four `shards=4` scrape jobs + `37 */6 * * *` instant alerts) for per-minute scheduling and more shards.

Manual fallback (local or one-off):

```bash
npm run scrape
npm run alerts:instant
```

If a specific source needs immediate attention, run `npm run scrape -- <slug>` locally to reproduce and refresh it.

**QStash cleanup:**

QStash no longer owns production scrape or alert schedules. The `qstash:cron` command remains only to list/delete retired Pathway schedules during cleanup. Add these local-only values to `.env.local` if you need to clean QStash:

| Variable | Example | Purpose |
| --- | --- | --- |
| `QSTASH_TOKEN` | `qstash_...` | Upstash QStash API token |
| `QSTASH_URL` | `https://qstash-us-east-1.upstash.io` | QStash regional API URL; use this when the default region returns 404 |

Manage schedules from the repo:

```bash
npm run qstash:cron -- list
npm run qstash:cron -- upsert
npm run qstash:cron -- delete
```

For US-region QStash tokens, set `QSTASH_URL=https://qstash-us-east-1.upstash.io`. For EU-region tokens, omit `QSTASH_URL` or set `https://qstash-eu-central-1.upstash.io`.
`upsert` creates no active schedules and deletes retired Pathway schedule IDs.

**Optional:**

```bash
LOGO_DEV_TOKEN=...              # /api/logo — publishable pk_ for img.logo.dev
NEXT_PUBLIC_SITE_URL=https://www.trypathway.app   # Referer sent to logo.dev (required if key has domain restrictions)
UPSTASH_REDIS_REST_URL=...      # Distributed rate limits (server actions, unsubscribe)
UPSTASH_REDIS_REST_TOKEN=...    # Falls back to in-memory limits when unset
OPENAI_API_KEY=...              # Scout only; currently locked by SCOUT_ENABLED=false
```

**Static company logos:** `npm run company-logos` (all active slugs) or `npm run company-logos -- --slug <slug>` after Discover onboarding. Commits `public/company-logos/*.png` and `lib/logo/static-slug-manifest.json`. In-app surfaces use static files when the slug is in the manifest; otherwise `/api/logo` proxy. Static logo responses are served with long-lived browser cache headers, so navigation should not refetch the full logo grid.

**Logos 403 in production:** Pathway does not rate-limit `/api/logo`. Intermittent **403** on logo requests is usually logo.dev rejecting the server-side fetch: publishable key + **Allowed domains only** without a matching `Referer`, or a wrong token. Ensure `NEXT_PUBLIC_SITE_URL` matches an allowed domain in the [logo.dev dashboard](https://www.logo.dev/dashboard) (include `www` if users hit that host), or disable domain restrictions for the key used in `LOGO_DEV_TOKEN`. After fixing env/dashboard, hard-refresh Companies (clears `pathway:logo-failed:v7` in session storage if logos were cached as missing).

Never prefix secrets with `NEXT_PUBLIC_`.

## Supabase advisors (run before deploy)

Via MCP or dashboard:

1. `get_advisors` **security** — fix any ERROR-level lints.
2. `get_advisors` **performance** — address WARN on hot paths (e.g. RLS `auth.uid()` initplan).
3. `select * from app_private.production_integrity_check();` — expect **0 violations** on every row.
4. `list_migrations` — confirm latest migration is applied remotely.

**Current dashboard item (Auth):** enable [leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

### Known advisor findings

- **`alert_unsubscribe_nonces` has RLS enabled with no policy** — intentional (service-role writes only; deny-all to clients). No action needed.
- **Leaked-password protection disabled** — enable in the Auth dashboard (see above).
- Alert write hardening (`drop_legacy_alert_write_rpcs_after_service_actions`, `harden_alert_validator_search_path`, `harden_chat_table_grants`, `drop_unused_billing_and_index`) was applied remotely on 2026-06-06. Re-run advisors after new schema changes.

## Supabase dashboard (manual)

Automate via MCP where possible (`list_migrations`, integrity SQL, advisors). Still verify in the dashboard:

### Auth

Signup is open to any valid email address. App code (`lib/auth/validation.ts`, used by `lib/actions/auth.ts`) still enforces basic hygiene: format checks and a disposable-domain blocklist. If you later need to restrict the audience (e.g. to `.edu`), add the rule in `getSignupEmailValidationError` **and** at the Auth layer (hook or signup restriction) so the anon key cannot bypass app rules.

- Email confirmation on
- Password policy: min 8 + mixed case, digit, symbol
- Leaked-password protection (if plan supports)
- Production SMTP
- Site URL + redirect allow-list for real domains only

### Platform

- Backups / PITR per plan; occasional restore drill
- RLS and grants reviewed after schema changes
- Postgres and Node runtime versions within Supabase support windows

## E2E

```bash
npm run test:e2e
```

Public smoke only (landing, auth, redirects, security headers). No credentials required. Run via `npm run test:preprod:full` before production deploys.

## Incidents

### App / API

- Vercel function logs and build output
- Structured log events: `server.boot`, `supabase.query_error`, `supabase.mutation_error`, `feed.*`

### Empty or stale Openings / Companies

1. **Openings and Companies read `scraped_postings`** — UI refresh does not scrape.
2. Check Vercel Cron logs for `/api/cron/scrape-postings` and `/api/cron/send-instant-alerts`. If needed, run `npm run scrape` locally with `SUPABASE_SERVICE_ROLE_KEY`.
3. Inspect `company_sources.last_success_at` / `last_failure_at` for failing companies.
4. Run `npm run scrape -- --verbose <slug>` locally with service role to reproduce.
5. After deploy, run `npm run scrape` once if data is needed before the next cron tick.

### Company industry labels / grouping

Taxonomy lives in `discover_industries`; `companies.industry` must be a valid FK slug. To fix misclassified companies or add slugs, see [discover-industries.md](./discover-industries.md) (migration + optional `scripts/generate-discover-industry-migration.mjs`).

### Posted date confusion

See [scraped-posted-dates.md](./scraped-posted-dates.md). **NEW** on Openings = `first_seen_at`, not ATS `updated_at`.

### Auth spikes

Supabase Auth logs for failed sign-in/signup.

### Rate limits

`public.rate_limits` for hot buckets.

### After manual DB fixes

Run `production_integrity_check()`. If the fix was durable, record it with `apply_migration`.
