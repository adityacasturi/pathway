# CLAUDE.md

Guidance for Claude Code and agents on Pathway.

## Documentation

| File | Contents |
| --- | --- |
| [docs/README.md](docs/README.md) | Doc index + terminology |
| [docs/architecture.md](docs/architecture.md) | System design |
| [docs/scraping.md](docs/scraping.md) | Scrape + company catalog |
| [docs/discover-industries.md](docs/discover-industries.md) | Industry taxonomy (`discover_industries`) |
| [docs/alerts-filters.md](docs/alerts-filters.md) | Alert filter semantics |
| [docs/production-runbook.md](docs/production-runbook.md) | Launch / incidents |
| [supabase/README.md](supabase/README.md) | DB workflow |
| [tests/README.md](tests/README.md) | Test layout |
| [AGENTS.md](AGENTS.md) | Agent rules (start here) |

## Commands

```bash
npm run dev              # dev server
npm run build            # production build
npm run start            # run build
npm run lint
npm run typecheck
npm run test:unit        # unit tests (tests/unit/**/*.test.ts)
npm run test:unit:coverage
npm run test:e2e         # Playwright public smoke (no credentials)
npm run test:preprod     # typecheck + audit + unit + build
npm run test:preprod:full # lint + test:preprod + e2e
npm run scrape           # scrape → scraped_postings (same runAllScrapes path as cron; native fetch adapters)
npm run alerts:instant   # send instant alert email for new matching postings
npm run company-logos    # static PNGs in public/company-logos + manifest
npm run discover-company # one-off company onboarding CLI
npm run discover-queue   # bulk onboarding queue CLI
npm run qstash:cron      # cleanup/list retired QStash schedules
npm run verify           # lint + test:preprod
```

Scrape/alerts cron: Vercel Cron (`vercel.json`). Hobby: four daily UTC windows (00/06/12/18) with two scrape shards + delayed instant alerts (no `*/6` — Hobby allows once-per-day expressions only). Pro: can use `7 */6 * * *` with four shards. Required Vercel Production env: `CRON_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ALERT_UNSUBSCRIBE_SECRET`.

## Next.js 16

Read `node_modules/next/dist/docs/` before changing routing, Server Components, Server Actions, metadata, caching, or `proxy.ts`.

## Product snapshot

Public signup (any valid email) · **Home** briefing · application tracker with event-derived status · **Openings** feed (global internships; per-user country filters) · **Companies** catalog · **Alerts** (email) · **Settings** (account, appearance).

| Route | Purpose |
| --- | --- |
| `/` | Landing (signed-in users → `/home`) |
| `/login`, `/register` | Auth |
| `/set-password` | Set/reset password |
| `/auth/confirm` | OTP / email-link verification (public) |
| `/home` | Dashboard briefing (default after sign-in) |
| `/applications` | Application tracker |
| `/openings` | Scraped roles feed |
| `/companies` | Companies + postings on demand |
| `/alerts` | Email alert subscriptions + filter prefs |
| `/settings` | Redirects to `/settings/account` |
| `/settings/account`, `/settings/appearance` | Account and theme |
| `/alerts/unsubscribe` | One-click unsubscribe (signed token, public) |
| `/api/logo` | Authenticated logo proxy (logo.dev) |
| `/api/cron/scrape-postings` | Sharded scrape handler (cron secret) |
| `/api/cron/send-instant-alerts` | Instant alert handler (cron secret) |
| `/api/cron/send-alert-digests` | Digest handler (cron secret; not scheduled) |

`proxy.ts`: unauthenticated users on protected routes → `/login?next=<path>`; authenticated users on `/`, `/login`, `/register` → `/home`. Public assets include `/company-logos/*` and cron routes.

## Data (Supabase)

- User: `applications`, `application_events`, `feed_interactions`, `discover_company_favorites`, `user_preferences`
- Alerts: `alert_preferences`, `alert_subscriptions`, `alert_sent_postings`, `alert_digest_state`, `alert_curated_sectors`, `alert_unsubscribe_nonces`
- Scrape catalog: `companies` (`industry` → `discover_industries`), `company_sources`, `scraped_postings`, `scrape_runs` (per-run health summary, service-role only)
- Status from events: `lib/config/events.ts`
- Alert writes: scoped server actions in `lib/actions/alerts.ts` (direct client table writes revoked).

Clients: `lib/supabase/server.ts` (user, RLS), `lib/supabase/admin.ts` (service role, bypasses RLS — server/cron/scripts only).

## Feeds

- **Openings:** `lib/feed/scraped-postings.ts` — `feed_interactions`, hide applied URLs, refresh does not scrape.
- **Companies:** `lib/discover/companies.ts` + `lib/discover/catalog.ts` — same scrape store; industries from `discover_industries`.
- **Alerts:** `lib/alerts/*` — match new postings to subscriptions, instant emails after Vercel Cron scrape, Resend delivery.

## Database

Remote migration history is truth. `apply_migration` → `list_migrations` → `production_integrity_check()` → advisors. Optional git SQL in `supabase/migrations/` for schema review only. Ignore `supabase/migrations_archive/` for agent context.

## UI

Midnight default accent · `components/ui/` primitives · `components/app-shell/` layout · simple Openings/Companies/Application rows (no row animation flourishes).
