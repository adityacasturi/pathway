# Architecture

Pathway is a Next.js 16 App Router app backed by Supabase Auth and Postgres. Students sign up with any valid email, track internship applications on a timeline, browse scraped roles on **Openings**, and browse employers on **Companies**.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 App Router, React 19, Server Components, Server Actions |
| Styling | Tailwind CSS v4 (`app/globals.css` tokens) |
| UI | Local primitives in `components/ui/` (`@base-ui/react`) |
| Data | Supabase Auth, Postgres, RLS, SQL functions/triggers |
| Scraping | Node scripts + Upstash QStash schedules + Next route handlers (`lib/scraping/`) |
| Tests | Node test runner (unit), Playwright (e2e) |
| Runtime | Node.js 22.x |

Before changing routing, caching, `proxy.ts`, or Server Components, read the relevant guide in `node_modules/next/dist/docs/`.

## Routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Landing; redirects authenticated users to `/home` |
| `/login` | Public | Sign in; password reset entry point |
| `/register` | Public | Dedicated signup form when signup is enabled |
| `/set-password` | Auth flow | Password reset completion |
| `/auth/confirm` | Public | OTP / email-link verification handler; validated `next` redirect |
| `/home` | Auth | Overview briefing: pipeline snapshot, "since yesterday", starred, "for later" |
| `/applications` | Auth | Application tracker and detail modal |
| `/openings` | Auth | Flat scraped internship feed (save / dismiss / track) |
| `/companies` | Auth | Company catalog; open roles loaded per company |
| `/insights` | Auth | Application metrics + funnel + market analytics |
| `/alerts` | Auth | Email alert subscriptions (companies / curated sectors) |
| `/settings` | Auth | Account and preferences (accent, quick track) |
| `/alerts/unsubscribe` | Public | One-click email unsubscribe (signed token) |
| `/api/logo` | Auth | Logo.dev proxy (not a public CDN) |
| `/api/cron/scrape-postings` | Cron | 30-minute sharded scrape (`Authorization: Bearer CRON_SECRET`) |
| `/api/cron/send-instant-alerts` | Cron | Instant alert delivery after scrape shards succeed |
| `/api/cron/send-alert-digests` | Cron | Daily digest alerts at 14:11 UTC |

`proxy.ts` gates routes: unauthenticated users on protected routes go to `/login?next=<path>`; authenticated users cannot stay on `/login`, `/register`, or `/`.

## Authentication and signup

- Signup flag: `SIGNUPS_ENABLED` in `lib/auth/signup-enabled.ts` (currently `true`).
- Server actions in `lib/actions/auth.ts` validate a normalized email via `lib/auth/validation.ts` (format checks + disposable-domain blocklist). Any valid email is accepted.
- **Future audience restriction:** to limit signups (e.g. to `.edu`), add the rule in `getSignupEmailValidationError` **and** configure Supabase Auth (hook or dashboard policy) so the anon key cannot bypass app validation. See [production-runbook.md](./production-runbook.md).

## Supabase data model

User-owned (RLS via `auth.uid()`):

| Table | Role |
| --- | --- |
| `applications` | Tracker rows: company, role, posting URL, season/location, archive, status snapshot |
| `application_events` | Timeline events |
| `feed_interactions` | Saved / dismissed Live posting ids (stable URL hashes) |
| `discover_company_favorites` | Starred Discover companies |
| `user_preferences` | Accent, quick-track, Live feed view prefs (`live_*`), Applications hide toggles (`hide_rejected`, `hide_archived`). Legacy browser-storage view keys are imported once and cleared. |
| `alert_preferences` | Email alerts master switch (`emails_enabled`, `digest_enabled`) |
| `alert_subscriptions` | Per-company or curated-sector alert follows |
| `alert_sent_postings` | Dedup ledger for sent alert emails |
| `alert_digest_state` | Last digest send timestamp per user |
| `alert_curated_sectors` | Curated sector labels/metadata; `alert_curated_sector_companies` maps sector → company slugs |
| `alert_unsubscribe_nonces` | Single-use unsubscribe nonces (service-role only; RLS deny-all to clients) |

Shared scrape catalog (authenticated read; writes via service role / cron):

| Table | Role |
| --- | --- |
| `companies` | Discover catalog entry (`slug`, `name`, `industry`, `logo_asset_key` for static PNG path, …) |
| `discover_industries` | Canonical Discover industry taxonomy (`slug`, `label`, `description`, `sort_order`) |
| `company_sources` | ATS config: `source_type`, `source_url`, `board_token`, scrape health timestamps |
| `scraped_postings` | Open roles from scrapes |

Other:

| Table | Role |
| --- | --- |
| `rate_limits` | Private backing store for DB-side write throttles |

Privileged logic lives in `app_private` (e.g. `production_integrity_check()`).

## Application status

Status is **derived from events**, not picked from a static dropdown. Canonical rules: `lib/config/events.ts`. Optimistic UI: `lib/config/application-state.ts`. DB triggers/RPCs keep direct Supabase writes consistent.

Priority (highest wins): rejected → offer → interview → OA → applied.

## Server actions

`lib/actions/`:

| Module | Responsibility |
| --- | --- |
| `auth.ts` | Login, signup, OTP, logout |
| `applications.ts` | CRUD and archive applications |
| `events.ts` | Timeline events |
| `feed.ts` | Live save / dismiss / refresh |
| `discover.ts` | Load company postings; star / unstar |
| `settings.ts` | User preferences |
| `alerts.ts` | Email alert subscriptions and master switch |

Pattern: validate input → Supabase server client or narrow RPC → `revalidatePath()` for affected routes.

## Supabase clients

| Module | Use |
| --- | --- |
| `lib/supabase/server.ts` | Cookie-aware server client (RLS as user) |
| `lib/supabase/auth.ts` | `getUser()` helper for server components |
| `lib/supabase/admin.ts` | Service role — bypasses RLS (scrapes, cron alert sends, unsubscribe writes, discover-company / discover-queue). Server/CLI only; guarded against browser use. |

## Openings feed

Loader: `lib/feed/scraped-postings.ts` → `FeedPosting` (`lib/feed/source.ts`).

- Open rows from `scraped_postings` for **active** companies with **enabled** `company_sources`.
- Market top-line counts for Home/Stats come from `public.market_posting_summary(_now)` so the DB performs the aggregate scan instead of recomputing every summary in React route code.
- Posting ids: stable URL hash (`lib/feed/ids.ts`) plus row uuid for interactions.
- **US-only:** `lib/feed/us-locations.ts` at scrape, upsert, and read; `countries` column stores ISO codes when known.
- **Posted vs Discovered:** see [scraped-posted-dates.md](./scraped-posted-dates.md). Live **NEW** uses `first_seen_at` vs the user's DB-backed `live_last_seen_at`, not ATS touch times.
- Applied postings hidden by default when posting URL matches an active application.
- `refreshFeed()` revalidates `/openings` and `/home` only — it does **not** scrape.

## Companies

Loader: `lib/discover/companies.ts`. UI: `components/discover-companies.tsx`.

- Industry taxonomy in **`discover_industries`**; each company’s `industry` column is an FK to that table (no in-app slug map). See [discover-industries.md](./discover-industries.md).
- Catalog loaded via `loadDiscoverIndustryCatalog()` in `lib/discover/catalog.ts`; grouping via `lib/discover/industries.ts`.
- Open role counts come from `public.discover_company_open_counts()`; the route no longer downloads every open posting just to count companies.
- Search, industry chips, season filter, starred section, paginated company list.
- Postings for a company load on demand via `fetchDiscoverCompanyPostings` (`lib/actions/discover.ts`).
- Company dialog rows reuse Live **Track** and **Save for later** (`feed_interactions`); applied postings (matching active application URL) are hidden; saved postings stay visible. No dismiss on Discover.
- Same scrape store and intern/engineering/US filters as Live — see [scraping.md](./scraping.md).

## Email alerts

- UI: `app/alerts/page.tsx`, `components/alerts-page.tsx`.
- **Daily digest** — global toggle (`alert_preferences.digest_enabled`); one morning email with new roles matching the user’s company and curated-sector follows.
- **Curated sector alerts** — global toggle (`emails_enabled`) plus subscriptions to sector slugs in `alert_curated_sectors` / `alert_curated_sector_companies` (loaded via `lib/alerts/load-curated-sectors.ts`); instant email when a new role appears at any company in a followed sector.
- Matching: `lib/alerts/match-postings.ts` (US-only, `first_seen_at` for new roles).
- Send: Resend via `lib/email/resend-client.ts`; instant after scrape, digest on daily cron.
- Env: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ALERT_UNSUBSCRIBE_SECRET` — see [production-runbook.md](./production-runbook.md).
- Launch gate: without `ALERTS_LAUNCHED=true`, the `/alerts` UI is preview-only (visible, non-interactive), server actions reject writes, and crons skip outbound email.
- DB: `alert_curated_sectors` + `app_private.validate_alert_subscription_row` trigger enforce sector/company targets and `cadence = instant` on writes; RLS uses `(select auth.uid())` for performance.
- Unsubscribe: `GET /alerts/unsubscribe` shows a confirm form; `POST` performs the disable (avoids mail-scanner GET side effects). Tokens include expiry + single-use nonce (`alert_unsubscribe_nonces`).
- Writes: server actions authenticate with the user session, then perform scoped service-role writes for that `user.id`; direct client table inserts and public alert write RPC execution are revoked.

## Scraping (summary)

- Cron: Upstash QStash schedules call `/api/cron/scrape-postings` every 15 minutes across four source shards, then `/api/cron/send-instant-alerts` a few minutes later. QStash also calls `/api/cron/send-alert-digests` daily at 14:11 UTC. Manage schedules with `npm run qstash:cron -- <list|upsert|delete>`.
- Local: `npm run scrape` (needs `SUPABASE_SERVICE_ROLE_KEY`).
- Adapters: `lib/scraping/registry.ts` keyed by `company_sources.source_type` (`lib/scraping/types.ts`).
- Full detail: [scraping.md](./scraping.md).

## UI conventions

- Default accent: **midnight** (`lib/config/accent.ts`, `user_preferences`).
- App shell: `components/sidebar.tsx`, `components/app-chrome.tsx`.
- Page structure: `PageShell`, `PageMain`, `PageHeader`, `PageSection` from `components/ui/page.tsx`.
- Dashboard and Discover rows stay simple — avoid per-row animation flourishes.

## Testing

```bash
npm run test:unit          # Node unit tests (scraping, feed, queue, …)
npm run test:e2e           # Playwright (public + optional auth)
npm run verify             # lint + typecheck + audit + unit + build
```

Authenticated e2e:

```bash
E2E_USER_EMAIL="..." E2E_USER_PASSWORD="..." npm run test:e2e
```

Mutation e2e (single worker, shared QA account):

```bash
E2E_ALLOW_MUTATION=1 E2E_USER_EMAIL="..." E2E_USER_PASSWORD="..." npm run test:e2e
```

Live tests expect scraped data in the linked project (cron or `npm run scrape`).

## Database changes

Remote Supabase migration history is authoritative. Workflow: [supabase/README.md](../supabase/README.md). Do not grep `supabase/migrations_archive/`.
