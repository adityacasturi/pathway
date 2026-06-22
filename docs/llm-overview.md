# Pathway — LLM project overview

Handoff document for coding agents and LLMs. For day-to-day commands see [../CLAUDE.md](../CLAUDE.md); for deep architecture see [architecture.md](./architecture.md).

## What it is

**Pathway** is a student internship tracker and job-discovery product. It scrapes internship postings directly from company career pages (not job boards), lets users browse a global feed, track applications with event-derived status, explore a company catalog, and receive email alerts when new roles match their filters.

**Audience:** students applying to internships (especially tech, quant, and related industries).

**Deployment:** Next.js on Vercel; Postgres + Auth on hosted Supabase.

---

## Product capabilities

| Feature | Route | Summary |
| --- | --- | --- |
| Landing | `/` | Marketing page with live openings preview; signed-in users redirect to `/home` |
| Auth | `/login`, `/register`, `/set-password`, `/auth/confirm` | Email/password via Supabase Auth; open signup with format + disposable-domain checks |
| Home | `/home` | Briefing dashboard: season snapshot, hot companies, alert activity, posting highlights, application attention |
| Applications | `/applications` | Tracker with inspector; status derived from timeline events (not manual dropdown) |
| Openings | `/openings` | Flat scraped internship feed; save/dismiss/track; hides applied URLs by default |
| Companies | `/companies` | Employer catalog by industry; postings loaded on demand per company |
| Alerts | `/alerts` | Email subscriptions (per company or industry bundle), filter prefs, instant + digest toggles |
| Scout | `/chat` | AI chat over openings catalog — **locked** (`SCOUT_ENABLED = false`) |
| Settings | `/settings/account`, `/settings/appearance` | Profile, accent (midnight/indigo/rose), theme |
| Unsubscribe | `/alerts/unsubscribe` | Public one-click email unsubscribe (HMAC + nonce) |

**Not a job board:** postings come from `company_sources` → ATS adapters → `scraped_postings`. Refresh in the UI does not trigger scrapes.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | **Next.js 16** App Router, React 19, Server Components, Server Actions |
| Language | TypeScript (Node **22.x**) |
| Styling | Tailwind CSS v4 (`app/globals.css` design tokens) |
| UI | HeroUI-backed primitives in `components/ui/`, Lucide icons, Sonner toasts, Framer Motion (subtle) |
| Data | **Supabase** Auth + Postgres + RLS |
| Email | **Resend** (alerts) |
| AI | Vercel AI SDK + OpenAI `gpt-4o-mini` (Scout, when enabled) |
| Scraping | `runAllScrapes` + typed adapters (`fetch` + JSON/HTML parsers); `resolvePostedAt` + `upsert.ts`; Vercel Cron in production |
| Tests | Node native test runner (unit), Playwright (public e2e smoke) |

**Important:** This repo uses Next.js 16 with breaking changes vs older versions. Read `node_modules/next/dist/docs/` before changing routing, `proxy.ts`, caching, or Server Components.

---

## Repository layout

```
app/                    # Next.js routes, layouts, API routes, cron handlers
components/             # UI by feature (app-shell, openings, companies, alerts, home, landing, …)
lib/
  actions/              # Server Actions (auth, applications, feed, discover, alerts, chat)
  alerts/               # Alert matching, email templates, digest/instant send
  config/               # Events, accent, scout flag, signup flag
  discover/             # Companies catalog loaders
  feed/                 # Openings feed (scraped-postings.ts, types, posted display)
  home/                 # Home briefing data
  scraping/             # Adapters, registry, upsert, scrape runner
  supabase/             # server.ts (user/RLS), admin.ts (service role)
  chat/                 # Scout tools and streaming helpers
scripts/                # scrape, discover-queue, company-logos, audits, alerts CLI
supabase/migrations/    # Optional git SQL for review; remote Supabase is schema truth
tests/unit/             # Unit tests (*.test.ts)
tests/e2e/              # Playwright public smoke
docs/                   # Architecture, scraping, alerts, runbooks
```

Path alias: `@/*` → repo root.

---

## Routing and auth

`proxy.ts` gates access:

- Unauthenticated users on protected routes → `/login?next=<path>`
- Authenticated users on `/`, `/login`, `/register` → `/home`

Public without login: landing, auth flows, `/alerts/unsubscribe`, cron API routes, static `/company-logos/*`.

### API routes

| Route | Auth | Purpose |
| --- | --- | --- |
| `/api/logo` | User | Logo.dev proxy for company logos |
| `/api/chat` | User | Scout streaming API (503 while locked) |
| `/api/cron/scrape-postings` | `CRON_SECRET` | Sharded scrape handler |
| `/api/cron/send-instant-alerts` | `CRON_SECRET` | Instant alert emails after scrape |
| `/api/cron/send-alert-digests` | `CRON_SECRET` | Digest handler (not scheduled in prod) |

---

## Data model (Supabase)

### User-owned (RLS via `auth.uid()`)

| Table | Purpose |
| --- | --- |
| `applications` | Tracker rows (company, role, URL, season, archive) |
| `application_events` | Timeline events; status is **derived** from these |
| `feed_interactions` | Saved/dismissed posting ids (stable URL hashes) |
| `discover_company_favorites` | Starred companies |
| `user_preferences` | Accent, Openings view prefs, live_last_seen_at, hide toggles |
| `alert_preferences` | Master email toggles, digest, global filter defaults |
| `alert_subscriptions` | Per-company or bundle follows |
| `alert_sent_postings` | Dedup ledger for sent emails |
| `alert_digest_state` | Last digest timestamp |
| `alert_curated_sectors` | Industry bundle metadata |
| `alert_unsubscribe_nonces` | Single-use unsubscribe tokens |
| `chat_threads`, `chat_messages`, `chat_tool_calls` | Scout (when enabled) |

### Shared scrape catalog (authenticated read; writes via service role / cron)

| Table | Purpose |
| --- | --- |
| `companies` | Catalog (`slug`, `name`, `industry` → `discover_industries`, logo) |
| `discover_industries` | Industry taxonomy |
| `company_sources` | ATS config: `source_type`, URL, board token, health |
| `scraped_postings` | Open roles from scrapes |
| `scrape_runs` | Per-run health summary (service-role only) |

Privileged RPCs live in `app_private` (e.g. `production_integrity_check()`).

### Application status rules

Defined in `lib/config/events.ts`. Priority (highest wins): **rejected → offer → interview → OA → applied**. UI uses optimistic updates via `lib/config/application-state.ts`.

---

## Core subsystems

### Openings feed

- Loader: `lib/feed/scraped-postings.ts` → `FeedPosting`
- Active companies with enabled sources only
- Posting ids: stable URL hash + row uuid for interactions
- Global catalog; per-user country filter pills narrow the view
- **Posted vs Discovered:** see [scraped-posted-dates.md](./scraped-posted-dates.md)
- **NEW** badge: `posted_at` vs `user_preferences.live_last_seen_at`
- Applied postings hidden when URL matches an active application

### Companies (Discover catalog)

- Loader: `lib/discover/companies.ts`
- Open counts via `public.discover_company_open_counts()`
- Postings on demand: `fetchDiscoverCompanyPostings` in `lib/actions/discover.ts`
- Same scrape store and intern filters as Openings

### Email alerts

- Matching: `lib/alerts/match-postings.ts` (filter rules in [alerts-filters.md](./alerts-filters.md))
- **Instant alerts:** after Vercel Cron scrape shards
- **Daily digest:** implemented but not scheduled in production
- Delivery: Resend; writes via scoped server actions in `lib/actions/alerts.ts` (direct client writes revoked)
- Required env: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ALERT_UNSUBSCRIBE_SECRET`

### Scraping

- Registry: `lib/scraping/registry.ts` keyed by `company_sources.source_type`
- Adapters: Greenhouse, Ashby, Workday, and many custom employer adapters under `lib/scraping/adapters/`
- Upsert: `lib/scraping/upsert.ts` → `scraped_postings`
- Location normalization: `lib/geo/` gazetteer (global, honest unknowns)
- Local: `npm run scrape`, `npm run scrape -- <slug>`, `npm run alerts:instant`
- Production: Vercel Cron in `vercel.json` (Hobby: 4 daily UTC windows, 2 shards; Pro can do `*/6` with 4 shards)
- Onboarding: `npm run discover-company`, `npm run discover-queue` (bulk SQLite queue)

### Scout (locked)

- Flag: `SCOUT_ENABLED = false` in `lib/config/scout.ts`
- `/chat` redirects to `/home`; `/api/chat` returns 503
- When enabled: streaming chat, tools query openings catalog, threads in DB

---

## Server actions and clients

| Module | Responsibility |
| --- | --- |
| `lib/actions/auth.ts` | Login, signup, OTP, logout |
| `lib/actions/applications.ts` | Application CRUD |
| `lib/actions/events.ts` | Timeline events |
| `lib/actions/feed.ts` | Openings save/dismiss/refresh |
| `lib/actions/discover.ts` | Company postings, favorites |
| `lib/actions/user-preferences.ts` | View prefs |
| `lib/actions/alerts.ts` | Alert subscriptions and prefs |
| `lib/actions/chat.ts` | Scout threads |

| Client | Use |
| --- | --- |
| `lib/supabase/server.ts` | Cookie-aware, RLS as user |
| `lib/supabase/admin.ts` | Service role — cron, scrape, alert sends, CLI only |

---

## Environment variables (production)

| Variable | Required for |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | App |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | App |
| `NEXT_PUBLIC_SITE_URL` | Auth redirects, email links |
| `SUPABASE_SERVICE_ROLE_KEY` | Scrape, cron, alert writes |
| `CRON_SECRET` | Vercel Cron handlers |
| `RESEND_API_KEY` | Outbound alert email |
| `RESEND_FROM_EMAIL` | Alert sender |
| `ALERT_UNSUBSCRIBE_SECRET` | Unsubscribe token signing |
| `OPENAI_API_KEY` | Scout only (when re-enabled) |

Never put secrets in `NEXT_PUBLIC_*`.

---

## Commands

```bash
npm run dev              # Dev server
npm run build            # Production build
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit
npm run test:unit        # Unit tests
npm run test:e2e         # Playwright public smoke (no credentials)
npm run test:preprod     # typecheck + audit + unit + build
npm run verify           # lint + test:preprod
npm run scrape           # Full scrape → scraped_postings
npm run alerts:instant     # Send instant alert emails
npm run discover-queue   # Bulk company onboarding worker
npm run discover-company   # One-off company onboarding
npm run company-logos      # Static PNGs + manifest
```

---

## Database workflow

**Hosted Supabase is authoritative.** Do not grep `supabase/migrations_archive/` for current schema.

1. Apply durable DDL/DML via Supabase MCP `apply_migration` (or CLI)
2. Verify: `list_migrations`, `select * from app_private.production_integrity_check()` (all `violations = 0`)
3. Optional git file under `supabase/migrations/` for review-worthy changes only

---

## UI conventions

- Default accent: **midnight** (black); also indigo, rose
- Page shell: `PageShell` from `components/design-system/page.tsx`
- App layout: `components/app-shell/`
- Company logos: `public/company-logos/` static PNGs; fallback `/api/logo`
- Listing rows: simple, consistent across Openings/Companies/Applications — no row animation flourishes
- Prefer `components/ui/` primitives; avoid new broad UI libraries

---

## Testing

- **Unit:** `tests/unit/**/*.test.ts` — alerts, scrape adapters, feed, auth, posted dates, etc.
- **E2E:** `tests/e2e/public.spec.ts` — landing, login/register public, protected redirects, static logos
- Claim production readiness only after `npm run test:preprod` or `npm run verify`

---

## Agent rules (short)

1. Read `AGENTS.md` and relevant `docs/` before large changes
2. Read `node_modules/next/dist/docs/` for Next.js 16 routing/caching/Server Actions
3. Match existing patterns in `app/`, `components/`, `lib/actions/`
4. Minimize scope; no secrets in client env; no broad RLS changes without migration
5. Scout is locked — do not route users to `/chat` unless re-enabling
6. Signup is open (valid email + disposable-domain blocklist in `lib/auth/validation.ts`)

---

## Further reading

| Doc | Topic |
| --- | --- |
| [architecture.md](./architecture.md) | Full system design |
| [scraping.md](./scraping.md) | Adapters, onboarding, location pipeline |
| [alerts-filters.md](./alerts-filters.md) | Alert matching semantics |
| [discover-industries.md](./discover-industries.md) | Industry taxonomy |
| [production-runbook.md](./production-runbook.md) | Deploy and incidents |
| [supabase/README.md](../supabase/README.md) | DB change workflow |
| [discover-queue/README.md](../discover-queue/README.md) | Bulk onboarding queue |
