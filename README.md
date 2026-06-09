# Pathway

Internship search and application tracking for students. **Home** briefing, **Applications** tracker, **Openings** feed, **Companies** catalog, and **Alerts** for new roles. **Scout** AI chat is present in the codebase but locked while it is in progress.

**Stack:** Next.js 16 · React 19 · Supabase · Tailwind v4 · Playwright

## Documentation

| Doc | When to read |
| --- | --- |
| [docs/README.md](docs/README.md) | Index of all documentation |
| [docs/architecture.md](docs/architecture.md) | Routes, data model, feeds, Scout, actions |
| [docs/scraping.md](docs/scraping.md) | Scrape runner, adapters, onboarding companies |
| [docs/discover-industries.md](docs/discover-industries.md) | Company industry taxonomy (`discover_industries`) |
| [docs/alerts-filters.md](docs/alerts-filters.md) | Alert season/country/remote filter semantics |
| [docs/production-runbook.md](docs/production-runbook.md) | Deploy and incident checks |
| [supabase/README.md](supabase/README.md) | Database changes (remote-first) |
| [tests/README.md](tests/README.md) | Unit and e2e test layout |
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

   # Email alerts (required for outbound alert email)
   RESEND_API_KEY=...
   RESEND_FROM_EMAIL="Pathway <alerts@yourdomain.com>"
   ALERT_UNSUBSCRIBE_SECRET=any-long-random-string

   # Scout chat (optional while Scout is locked)
   OPENAI_API_KEY=sk-...

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
| `npm run test:e2e` | Playwright public smoke (no credentials) |
| `npm run test:e2e:ui` | Playwright UI mode |
| `npm run test:preprod:full` | lint + verify + e2e |
| `npm run verify` | lint + typecheck + audit + unit + build |
| `npm run scrape` | Scrape boards → `scraped_postings` |
| `npm run alerts:instant` | Send instant alert email for new matching postings |
| `npm run discover-company` | Onboard one company (dry-run or `--apply --scrape`) |
| `npm run discover-queue` | Bulk Discover onboarding queue CLI |
| `npm run company-logos` | Download static PNGs + manifest |
| `npm run qstash:cron` | Cleanup/list retired QStash schedules |

### E2E

`npm run test:e2e` runs anonymous smoke tests only (landing, auth, redirects, security headers). Playwright starts the production build on port 3100 — run `npm run build` first, or use `npm run test:preprod:full`. Set `E2E_BASE_URL` to reuse an existing server.

## Project layout

```text
app/                    Routes, layouts, cron + chat + logo API
components/             Product UI (app-shell/, home/, openings/, companies/, …)
components/ui/          Design-system primitives
lib/actions/            Server Actions
lib/alerts/             Email alert matching, digest/instant send
lib/auth/               Signup / login validation helpers
lib/chat/               Scout tools, prompts, persistence
lib/config/             Events, accent, season filter, nav, status colors
lib/discover/           Companies catalog loaders (discover_industries)
lib/feed/               Openings feed types and loaders
lib/home/               Home briefing helpers
lib/scraping/           Adapters, upsert, scrape runner
lib/supabase/           Supabase clients (user + service role)
discover-queue/         Onboarding queue (SQLite + inbox.json)
docs/                   Architecture, scraping, runbook
supabase/               DB workflow + archived SQL history
tests/e2e/              Playwright smoke tests
tests/unit/             Node unit tests
```

## Product notes

- Public signup: open to any valid email. App-level hygiene (format + disposable-domain blocklist) lives in `lib/auth/validation.ts`. To restrict the audience later, enforce both in app code and at the Auth layer — see [docs/production-runbook.md](docs/production-runbook.md).
- Default post-login route: **Home** (`/home`). Default accent: **midnight** (`user_preferences`).
- Openings hides postings you already applied to (by normalized posting URL).
- Scrape ingestion: GitHub Actions runs `npm run scrape` + `npm run alerts:instant` every 6 hours; local `npm run scrape`.
- Email alerts (`/alerts`) send when `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `ALERT_UNSUBSCRIBE_SECRET` are configured.
- Scout is locked for now (`SCOUT_ENABLED = false` in `lib/config/scout.ts`); `/chat` redirects to `/home` and `/api/chat` returns 503. Re-enable later with `OPENAI_API_KEY`.

## Agents and database work

Read [AGENTS.md](AGENTS.md). Summary:

- **Supabase remote** = source of truth for schema and migration history.
- Apply changes with `apply_migration`; verify integrity check and advisors.
- Do **not** grep `supabase/migrations_archive/` (historical, ignored by Cursor).
- Onboard companies via `npm run discover-company` or [discover-queue/](discover-queue/) — see [docs/scraping.md](docs/scraping.md).
