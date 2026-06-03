# Production runbook

## Pre-deploy checklist

- [ ] Node.js 22.x in CI and Vercel
- [ ] `npm run verify` green
- [ ] `npm run test:unit` green
- [ ] `npm run test:e2e` (public)
- [ ] Authenticated e2e with `E2E_USER_EMAIL` / `E2E_USER_PASSWORD`
- [ ] Optional mutation e2e: `E2E_ALLOW_MUTATION=1` on a **dedicated QA account only**
- [ ] New DB changes present in Supabase `list_migrations` (not ad-hoc SQL only)
- [ ] `select * from app_private.production_integrity_check();` → **0 rows**
- [ ] Supabase security/performance advisors reviewed
- [ ] Production env vars set (see below)

## Database changes

1. `apply_migration` (MCP or CLI) with a descriptive name.
2. Confirm `list_migrations`.
3. `select * from app_private.production_integrity_check();` → 0 rows.
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
CRON_SECRET=...                 # /api/cron/scrape-postings, /api/cron/send-instant-alerts, /api/cron/send-alert-digests
RESEND_API_KEY=...              # Email alerts (Resend)
RESEND_FROM_EMAIL=...           # Verified sender, e.g. Pathway Alerts <alerts@yourdomain.com>
ALERT_UNSUBSCRIBE_SECRET=...    # Random secret for signed unsubscribe tokens
```

**Alerts launch (preview vs live):**

- Omit `ALERTS_LAUNCHED` (or set anything other than `true` / `1` / `yes`) on dev/staging so `/alerts` stays preview-only and crons skip outbound email.
- Set `ALERTS_LAUNCHED=true` only when Resend is verified and you want real subscriptions + delivery.

**QStash cron (production schedules):**

Add these local-only values to `.env.local` for schedule management:

| Variable | Example | Purpose |
| --- | --- | --- |
| `CRON_BASE_URL` | `https://www.trypathway.app` | Production deployment URL (no trailing slash) |
| `CRON_SECRET` | same as Vercel | Forwarded as `Authorization: Bearer` to cron routes |
| `QSTASH_TOKEN` | `qstash_...` | Upstash QStash API token |
| `QSTASH_URL` | `https://qstash-us-east-1.upstash.io` | QStash regional API URL; use this when the default region returns 404 |

Manage schedules from the repo:

```bash
npm run qstash:cron -- list
npm run qstash:cron -- upsert
npm run qstash:cron -- delete
```

For US-region QStash tokens, set `QSTASH_URL=https://qstash-us-east-1.upstash.io`. For EU-region tokens, omit `QSTASH_URL` or set `https://qstash-eu-central-1.upstash.io`.

`upsert` is idempotent because each schedule uses a stable `Upstash-Schedule-Id`. It also removes retired Pathway schedule IDs after creating the current schedules so renamed jobs do not keep running in parallel. Scrape cadence is every 30 minutes. Each cycle fans out to four shards on staggered minute offsets:

```text
pathway-discover-scrape-shard-0  :07,:37  /api/cron/scrape-postings?shard=0&shards=4&alerts=0
pathway-discover-scrape-shard-1  :08,:38  /api/cron/scrape-postings?shard=1&shards=4&alerts=0
pathway-discover-scrape-shard-2  :09,:39  /api/cron/scrape-postings?shard=2&shards=4&alerts=0
pathway-discover-scrape-shard-3  :10,:40  /api/cron/scrape-postings?shard=3&shards=4&alerts=0
```

QStash calls `pathway-alerts-instant-delivery` (`/api/cron/send-instant-alerts`) at `:15` and `:45` UTC. `pathway-alerts-daily-digest` (`/api/cron/send-alert-digests`) remains daily at 14:11 UTC. QStash retries delivery failures; missed or failed scrape cycles are acceptable because the next 30-minute cycle rechecks the same sources.

**Optional:**

```bash
LOGO_DEV_TOKEN=...              # /api/logo — publishable pk_ for img.logo.dev
NEXT_PUBLIC_SITE_URL=https://www.trypathway.app   # Referer sent to logo.dev (required if key has domain restrictions)
UPSTASH_REDIS_REST_URL=...      # Distributed rate limits (server actions, unsubscribe)
UPSTASH_REDIS_REST_TOKEN=...    # Falls back to in-memory limits when unset
```

**Static company logos:** `npm run company-logos` (all active slugs) or `npm run company-logos -- --slug <slug>` after Discover onboarding. Commits `public/company-logos/*.png` and `lib/logo/static-slug-manifest.json`. In-app surfaces use static files when the slug is in the manifest; otherwise `/api/logo` proxy. Static logo responses are served with long-lived browser cache headers, so navigation should not refetch the full logo grid.

**Logos 403 in production:** Pathway does not rate-limit `/api/logo`. Intermittent **403** on logo requests is usually logo.dev rejecting the server-side fetch: publishable key + **Allowed domains only** without a matching `Referer`, or a wrong token. Ensure `NEXT_PUBLIC_SITE_URL` matches an allowed domain in the [logo.dev dashboard](https://www.logo.dev/dashboard) (include `www` if users hit that host), or disable domain restrictions for the key used in `LOGO_DEV_TOKEN`. After fixing env/dashboard, hard-refresh Discover (clears `pathway:logo-failed:v7` in session storage if logos were cached as missing).

Never prefix secrets with `NEXT_PUBLIC_`.

## Supabase advisors (run before deploy)

Via MCP or dashboard:

1. `get_advisors` **security** — fix any ERROR-level lints.
2. `get_advisors` **performance** — address WARN on hot paths (e.g. RLS `auth.uid()` initplan).
3. `select * from app_private.production_integrity_check();` — expect **0 violations** on every row.
4. `list_migrations` — confirm latest migration (e.g. `harden_alert_rls`) is applied remotely.

**Current dashboard item (Auth):** enable [leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

### Known advisor findings (review before launch)

Last verified against the hosted project during the v2 pre-launch sweep:

- **Alert write RPC exposure** — **resolved** (migrations `revoke_public_execute_on_alert_rpcs`, `revoke_authenticated_alert_write_rpcs`). Alert writes now flow through server actions that authenticate the user and perform scoped service-role writes for that `user.id`; client `EXECUTE` on the legacy public write RPCs is revoked.
- **`alert_unsubscribe_nonces` has RLS enabled with no policy** — intentional (service-role writes only; deny-all to clients). No action needed.
- **Leaked-password protection disabled** — enable in the Auth dashboard (see above).

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
E2E_USER_EMAIL="pathway.qa.20260513@uw.edu" \
E2E_USER_PASSWORD="..." \
npm run test:e2e
```

Mutation (single worker):

```bash
E2E_ALLOW_MUTATION=1 \
E2E_USER_EMAIL="..." \
E2E_USER_PASSWORD="..." \
npm run test:e2e
```

Use a dedicated QA account — not a personal user.

## Incidents

### App / API

- Vercel function logs and build output
- Structured log events: `server.boot`, `supabase.query_error`, `supabase.mutation_error`, `feed.*`

### Empty or stale Live / Discover

1. **Live/Discover read `scraped_postings`** — UI refresh does not scrape.
2. Check QStash schedules with `npm run qstash:cron -- list` (30-minute sharded scrape) or run `curl` against `/api/cron/scrape-postings` with `CRON_SECRET`.
3. Inspect `company_sources.last_success_at` / `last_failure_at` for failing companies.
4. Run `npm run scrape -- --verbose <slug>` locally with service role to reproduce.
5. After deploy, run `npm run scrape` once if data is needed before the next 30-minute cron tick.

### Discover industry labels / grouping

Taxonomy lives in `discover_industries`; `companies.industry` must be a valid FK slug. To fix misclassified companies or add slugs, see [discover-industries.md](./discover-industries.md) (migration + optional `scripts/generate-discover-industry-migration.mjs`).

### Posted date confusion

See [scraped-posted-dates.md](./scraped-posted-dates.md). **NEW** on Live = `first_seen_at`, not ATS `updated_at`.

### Auth spikes

Supabase Auth logs for failed sign-in/signup.

### Rate limits

`public.rate_limits` for hot buckets.

### After manual DB fixes

Run `production_integrity_check()`. If the fix was durable, record it with `apply_migration`.
