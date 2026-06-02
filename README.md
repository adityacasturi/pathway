# Pathway

Internship search and application tracking for students. Get a daily **Home** briefing, track applications and timelines, browse scraped roles on **Live**, explore employers on **Discover**, see trends on **Stats**, and get **email alerts** for new roles.

**Stack:** Next.js 16 · React 19 · Supabase · Tailwind v4 · Playwright

## Documentation

| Doc | When to read |
| --- | --- |
| [docs/README.md](docs/README.md) | Index of all documentation |
| [docs/architecture.md](docs/architecture.md) | Routes, data model, feeds, actions |
| [docs/scraping.md](docs/scraping.md) | Scrape runner, adapters, onboarding companies |
| [docs/discover-industries.md](docs/discover-industries.md) | Discover industry taxonomy (Supabase) |
| [docs/production-runbook.md](docs/production-runbook.md) | Deploy and incident checks |
| [supabase/README.md](supabase/README.md) | Database changes (remote-first) |
| [AGENTS.md](AGENTS.md) | Rules for coding agents |

## Requirements

- Node.js **22.x**
- npm **10.x**
- Access to the team Supabase project (current schema already applied — see [supabase/README.md](supabase/README.md))

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local`:

   ```bash
   # Supabase (required)
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   NEXT_PUBLIC_SITE_URL=http://localhost:3000

   # Scraping (required for npm run scrape and cron parity)
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   CRON_SECRET=any-long-random-string-for-local-cron-tests

   # Email alerts (required for /alerts sends; see docs/production-runbook.md)
   RESEND_API_KEY=...
   RESEND_FROM_EMAIL="Pathway <alerts@yourdomain.com>"
   ALERT_UNSUBSCRIBE_SECRET=any-long-random-string
   ALERTS_LAUNCHED=true            # gate: omit to keep /alerts preview-only

   # Distributed rate limiting (recommended in production)
   UPSTASH_REDIS_REST_URL=...
   UPSTASH_REDIS_REST_TOKEN=...

   # Optional
   LOGO_DEV_TOKEN=...
   ```

3. Start the app:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Sign up with any valid email on the linked project.

4. (Optional) Populate scraped roles:

   ```bash
   npm run scrape
   ```

   Or scrape one company: `npm run scrape -- stripe`

You do **not** need to run SQL files from git — the hosted database is already migrated.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Run production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm run test:unit` | Unit tests (`tests/unit/`) |
| `npm run test:e2e` | Playwright |
| `npm run test:e2e:ui` | Playwright UI mode |
| `npm run scrape` | Scrape boards → `scraped_postings` |
| `npm run discover-queue` | Discover onboarding queue CLI |
| `npm run verify` | lint + typecheck + audit + unit + build |

### E2E

Public tests run without credentials.

Authenticated:

```bash
E2E_USER_EMAIL="your-qa@example.com" \
E2E_USER_PASSWORD="..." \
npm run test:e2e
```

Mutation tests (shared QA account, single worker):

```bash
E2E_ALLOW_MUTATION=1 \
E2E_USER_EMAIL="..." \
E2E_USER_PASSWORD="..." \
npm run test:e2e
```

Live tests expect open rows in `scraped_postings` on the linked project.

## Project layout

```text
app/                    Routes, layouts, cron + logo API
components/             Product UI (incl. landing/ and ui/ primitives)
components/ui/          Design-system primitives
lib/actions/            Server Actions
lib/auth/               Signup / login validation helpers
lib/config/             Events, accent, season filter, nav, status colors, alerts launch gate
lib/discover/           Discover loaders (catalog from discover_industries)
lib/feed/               Live feed types and loaders
lib/home/               Home briefing aggregation
lib/alerts/             Email alert matching, digest/instant send, unsubscribe tokens
lib/email/              Resend client + email templates
lib/stats/              Application + market analytics
lib/scraping/           Adapters, upsert, scrape runner
lib/supabase/           Supabase clients (user + service role)
discover-queue/         Onboarding queue (SQLite + inbox.json)
docs/                   Architecture, scraping, runbook
supabase/               DB workflow + archived SQL history
tests/e2e/              Playwright
tests/unit/             Node unit tests
```

## Product notes

- Public signup: open to any valid email. App-level hygiene (format + disposable-domain blocklist) lives in `lib/auth/validation.ts`. To restrict the audience later, enforce both in app code and at the Auth layer — see [docs/production-runbook.md](docs/production-runbook.md).
- Default accent: **midnight** (`user_preferences`).
- Discover hides postings you already applied to (by normalized posting URL).
- Scrape ingestion: QStash 30-minute cron in production; local `npm run scrape`.
- Email alerts (`/alerts`) are launch-gated by `ALERTS_LAUNCHED` / `lib/config/alerts-launch.ts`.

## Agents and database work

Read [AGENTS.md](AGENTS.md). Summary:

- **Supabase remote** = source of truth for schema and migration history.
- Apply changes with `apply_migration`; verify integrity check and advisors.
- Do **not** grep `supabase/migrations_archive/` (historical, ignored by Cursor).
- Onboard Discover companies via [discover-queue/](discover-queue/) and [docs/scraping.md](docs/scraping.md).
