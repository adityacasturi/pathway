# CLAUDE.md

Guidance for Claude Code and agents on Pathway.

## Documentation

| File | Contents |
| --- | --- |
| [docs/README.md](docs/README.md) | Doc index |
| [docs/architecture.md](docs/architecture.md) | System design |
| [docs/scraping.md](docs/scraping.md) | Scrape + Discover catalog |
| [docs/discover-industries.md](docs/discover-industries.md) | Industry taxonomy (`discover_industries`) |
| [docs/production-runbook.md](docs/production-runbook.md) | Launch / incidents |
| [supabase/README.md](supabase/README.md) | DB workflow |
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
npm run test:e2e         # Playwright
npm run test:preprod     # typecheck + audit + unit + build
npm run test:preprod:full # lint + test:preprod + e2e
npm run scrape           # scrape → scraped_postings (service role)
npm run company-logos    # static PNGs in public/company-logos + manifest
npm run discover-queue   # onboarding queue CLI
npm run verify           # lint + test:preprod
```

E2e: `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`. Mutations: `E2E_ALLOW_MUTATION=1` (one worker). Scrape/cron: `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.

## Next.js 16

Read `node_modules/next/dist/docs/` before changing routing, Server Components, Server Actions, metadata, caching, or `proxy.ts`.

## Product snapshot

Public signup (any valid email) · application tracker with event-derived status · **Home** briefing snapshot · **Live** flat feed · **Discover** company catalog · **Stats** (metrics + market) · **Alerts** (email digests) · **Settings** (accent, quick track).

| Route | Purpose |
| --- | --- |
| `/` | Landing |
| `/login`, `/register` | Auth (`/register` → signup mode) |
| `/set-password` | Set/reset password |
| `/auth/confirm` | OTP / email-link verification handler (public) |
| `/home` | Overview briefing (snapshot, since-yesterday, starred) |
| `/applications` | Tracker |
| `/live` | Scraped roles feed |
| `/discover` | Companies + postings on demand |
| `/stats` | Application metrics + market analytics |
| `/alerts` | Email alert subscriptions (company + curated sectors) |
| `/alerts/unsubscribe` | One-click unsubscribe (HMAC token, public) |
| `/settings` | Preferences |
| `/api/logo` | Authenticated logo proxy (logo.dev) |
| `/api/cron/scrape-postings` | 30-minute sharded scrape (cron secret) |
| `/api/cron/send-alert-digests` | Daily digest send (cron secret) |

`proxy.ts`: unauthenticated → `/` (except public routes); authenticated cannot stay on `/login`.

## Data (Supabase)

- User: `applications`, `application_events`, `feed_interactions`, `discover_company_favorites`, `user_preferences`
- Alerts: `alert_preferences`, `alert_subscriptions`, `alert_sent_postings`, `alert_digest_state`, `alert_curated_sectors`, `alert_unsubscribe_nonces`
- Scrape: `companies` (`industry` → `discover_industries`), `company_sources`, `scraped_postings`
- Status from events: `lib/config/events.ts`
- Alert writes go through `SECURITY DEFINER` RPCs (direct table writes revoked); see `lib/actions/alerts.ts`.

Clients: `lib/supabase/server.ts` (user, RLS), `lib/supabase/admin.ts` (service role, bypasses RLS — server/cron/scripts only).

## Feeds

- **Home:** `lib/home/briefing.ts` → `components/home/*` — snapshot pipeline counts, "since yesterday", starred, "for later".
- **Live:** `lib/feed/scraped-postings.ts` — `feed_interactions`, hide applied URLs, refresh does not scrape.
- **Discover:** `lib/discover/companies.ts` + `lib/discover/catalog.ts` — same scrape store; industries from `discover_industries`; QStash 30-minute cron `/api/cron/scrape-postings`; local `npm run scrape`.
- **Alerts:** `lib/alerts/*` — match new postings to subscriptions, instant emails after scrape cron + daily digest, Resend delivery, launch-gated by `lib/config/alerts-launch.ts`.

## Database

Remote migration history is truth. `apply_migration` → `list_migrations` → `production_integrity_check()` → advisors. Optional git SQL in `supabase/migrations/` for schema review only. Ignore `supabase/migrations_archive/` for agent context.

## UI

Midnight default accent · `components/ui/` · `components/sidebar.tsx` · simple dashboard/Discover rows.
