# Architecture

Pathway is a Next.js 16 App Router app backed by Supabase Auth and Postgres. Students sign up with any valid email, get a **Home** briefing, track internship applications on a timeline, browse scraped roles on **Openings**, explore employers on **Companies**, and configure **Alerts**. **Scout** chat is implemented but locked while in progress.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 App Router, React 19, Server Components, Server Actions |
| Styling | Tailwind CSS v4 (`app/globals.css` tokens) |
| UI | HeroUI-backed primitives in `components/ui/`, design-system surfaces, TanStack Table, Recharts, Framer Motion, Lucide icons, Sonner |
| Data | Supabase Auth, Postgres, RLS, SQL functions/triggers |
| AI | Vercel AI SDK + OpenAI (`gpt-4o-mini`) for Scout |
| Scraping | Node scripts + Vercel Cron + Next route handlers (`lib/scraping/`) |
| Tests | Node test runner (unit), Playwright public smoke (e2e) |
| Runtime | Node.js 22.x |

Before changing routing, caching, `proxy.ts`, or Server Components, read the relevant guide in `node_modules/next/dist/docs/`.

## Routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Landing; signed-in users redirect to `/home` |
| `/login` | Public | Sign in; password reset entry point |
| `/register` | Public | Signup when `SIGNUPS_ENABLED` is true |
| `/set-password` | Auth flow | Password reset completion |
| `/auth/confirm` | Public | OTP / email-link verification; validated `next` redirect |
| `/home` | Auth | Briefing dashboard (default after sign-in) |
| `/applications` | Auth | Application tracker and inspector |
| `/openings` | Auth | Flat scraped internship feed (save / dismiss / track) |
| `/companies` | Auth | Company catalog; open roles loaded per company |
| `/alerts` | Auth | Email alert subscriptions, filters, master toggles |
| `/chat` | Auth | Scout placeholder; redirects to `/home` while locked |
| `/settings` | Auth | Redirects to `/settings/account` |
| `/settings/account` | Auth | Profile, sign out, password reset |
| `/settings/appearance` | Auth | Accent color and theme |
| `/alerts/unsubscribe` | Public | One-click email unsubscribe (signed token) |
| `/api/logo` | Auth | Logo.dev proxy (not a public CDN) |
| `/api/chat` | Auth | Streaming Scout API; returns 503 while locked |
| `/api/cron/scrape-postings` | Cron | Sharded scrape handler (`Authorization: Bearer CRON_SECRET`) |
| `/api/cron/send-instant-alerts` | Cron | Instant alert handler (`Authorization: Bearer CRON_SECRET`) |
| `/api/cron/send-alert-digests` | Cron | Digest handler (`Authorization: Bearer CRON_SECRET`; not scheduled) |

`proxy.ts` gates routes: unauthenticated users on protected routes go to `/login?next=<path>`; authenticated users on `/`, `/login`, or `/register` go to `/home`. Public routes include landing, auth, unsubscribe, cron handlers, and static logo assets under `/company-logos/`.

## Authentication and signup

- Signup flag: `SIGNUPS_ENABLED` in `lib/auth/signup-enabled.ts` (currently `true`).
- Server actions in `lib/actions/auth.ts` validate email via `lib/auth/validation.ts` (format + disposable-domain blocklist).
- **Future audience restriction:** add rules in `getSignupEmailValidationError` **and** configure Supabase Auth so the anon key cannot bypass app validation. See [production-runbook.md](./production-runbook.md).

## Supabase data model

User-owned (RLS via `auth.uid()`):

| Table | Role |
| --- | --- |
| `applications` | Tracker rows: company, role, posting URL, season/location, archive, status snapshot |
| `application_events` | Timeline events |
| `feed_interactions` | Saved / dismissed Openings posting ids (stable URL hashes) |
| `discover_company_favorites` | Starred Companies |
| `user_preferences` | Accent, quick-track, Openings view prefs (`live_*` columns), Applications hide toggles |
| `alert_preferences` | Email alerts master switch, digest toggle, global filter defaults |
| `alert_subscriptions` | Per-company or bundle alert follows |
| `alert_sent_postings` | Dedup ledger for sent alert emails |
| `alert_digest_state` | Last digest send timestamp per user |
| `alert_curated_sectors` | Industry bundle labels/metadata; `alert_curated_sector_companies` maps bundle → company slugs |
| `alert_unsubscribe_nonces` | Single-use unsubscribe nonces (service-role only) |
| `chat_threads` | Scout conversation metadata |
| `chat_messages` | Persisted message parts (JSON) |
| `chat_tool_calls` | Tool audit summaries per thread |

Shared scrape catalog (authenticated read; writes via service role / cron):

| Table | Role |
| --- | --- |
| `companies` | Catalog entry (`slug`, `name`, `industry`, `logo_asset_key`, …) |
| `discover_industries` | Industry taxonomy (`slug`, `label`, `description`, `sort_order`) |
| `company_sources` | ATS config: `source_type`, `source_url`, `board_token`, scrape health |
| `scraped_postings` | Open roles from scrapes |

Other:

| Table | Role |
| --- | --- |
| `rate_limits` | Private backing store for DB-side write throttles |

Privileged logic lives in `app_private` (e.g. `production_integrity_check()`).

## Application status

Status is **derived from events**, not picked from a static dropdown. Rules: `lib/config/events.ts`. Optimistic UI: `lib/config/application-state.ts`. DB triggers/RPCs keep direct Supabase writes consistent.

Priority (highest wins): rejected → offer → interview → OA → applied.

## Server actions

`lib/actions/`:

| Module | Responsibility |
| --- | --- |
| `auth.ts` | Login, signup, OTP, logout |
| `applications.ts` | CRUD and archive applications |
| `events.ts` | Timeline events |
| `feed.ts` | Openings save / dismiss / refresh |
| `discover.ts` | Load company postings; star / unstar |
| `user-preferences.ts` | Openings view prefs, Applications hide toggles |
| `settings.ts` | Password reset email |
| `alerts.ts` | Email alert subscriptions, filters, master switch |
| `chat.ts` | Scout thread list/create/load/delete |

Pattern: validate input → Supabase server client or scoped service-role write → `revalidatePath()` for affected routes.

## Supabase clients

| Module | Use |
| --- | --- |
| `lib/supabase/server.ts` | Cookie-aware server client (RLS as user) |
| `lib/supabase/auth.ts` | `getUser()` helper for server components |
| `lib/supabase/admin.ts` | Service role — scrapes, cron, alert writes, discover CLI. Server/CLI only. |

## Home (`/home`)

- UI: `components/home/home-page.tsx`.
- Data: `lib/home/briefing.ts`, `lib/home/season-snapshot.ts`, `lib/home/alert-activity.ts`, `lib/home/posting-slots.ts`.
- Surfaces: season snapshot, hot companies, recent alert activity, Openings highlights, application attention items.
- Market aggregates via `public.market_posting_summary(_now)`.

## Openings feed

Loader: `lib/feed/scraped-postings.ts` → `FeedPosting` (`lib/feed/source.ts`).

- Open rows from `scraped_postings` for **active** companies with **enabled** `company_sources`.
- Posting ids: stable URL hash (`lib/feed/ids.ts`) plus row uuid for interactions.
- `countries` on `scraped_postings` stores ISO codes when known. The catalog is global: roles from any country are stored and shown, and per-user country filter pills (Openings/Companies/Alerts) handle narrowing. Unknown locations are stored honestly (`location` null, `raw_location` preserved, UI shows "Unknown") rather than guessed.
- **Posted vs Discovered:** see [scraped-posted-dates.md](./scraped-posted-dates.md). **NEW** badge uses `posted_at` vs `user_preferences.live_last_seen_at`.
- Applied postings hidden by default when posting URL matches an active application.
- `refreshFeed()` revalidates `/openings` only — it does **not** scrape.

## Companies

Loader: `lib/discover/companies.ts`. UI: `components/companies/companies-page.tsx`.

- Industry taxonomy in **`discover_industries`**; `companies.industry` FK. See [discover-industries.md](./discover-industries.md).
- Open role counts from `public.discover_company_open_counts()`.
- Postings load on demand via `fetchDiscoverCompanyPostings` (`lib/actions/discover.ts`).
- Company inspector reuses Openings **Track** and **Save for later** (`feed_interactions`); applied postings hidden.
- Same scrape store and intern/engineering filters as Openings — see [scraping.md](./scraping.md).

## Scout (`/chat`)

- Feature flag: `SCOUT_ENABLED` in `lib/config/scout.ts` (currently `false`).
- While locked, the sidebar/mobile nav show Scout as a disabled coming-soon item, `/chat` redirects to `/home`, and `/api/chat` returns 503.
- UI: `components/chat/chat-page.tsx`.
- Streaming API: `app/api/chat/route.ts` (OpenAI `gpt-4o-mini` via Vercel AI SDK).
- Tools in `lib/chat/tools.ts` query the openings catalog; results render as embedded UI blocks.
- Threads/messages in `chat_threads` / `chat_messages`; audit in `chat_tool_calls`.
- Env when re-enabled: `OPENAI_API_KEY`. Without it, `/api/chat` returns 503.

## Email alerts

- UI: `app/alerts/page.tsx`, `components/alerts/alerts-page.tsx` (and related `components/alerts/*`).
- **Daily digest** — `alert_preferences.digest_enabled` + `/api/cron/send-alert-digests` handler exist but digest is not scheduled in production and has no in-app toggle yet.
- **Instant alerts** — `alert_preferences.emails_enabled` + company/industry bundle subscriptions in `alert_subscriptions`.
- Filter semantics: [alerts-filters.md](./alerts-filters.md).
- Matching: `lib/alerts/match-postings.ts` (`posted_at` for new or republished roles).
- Send: Resend via `lib/email/resend-client.ts`; instant alerts run after Vercel Cron scrape shards complete. The digest handler remains available but is not scheduled in production.
- Env: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ALERT_UNSUBSCRIBE_SECRET`.
- Unsubscribe: `GET /alerts/unsubscribe` confirm form; `POST` performs disable. HMAC token + single-use nonce.
- Writes: server actions authenticate the user, then perform scoped service-role writes; direct client alert table writes are revoked.

## Scraping (summary)

- Cron: `vercel.json` → `/api/cron/scrape-postings` → `runAllScrapes` → adapter registry → `upsert.ts` + `posted-at.ts`. Same path as `npm run scrape`. On Hobby, four daily UTC windows (00/06/12/18) with two shards each; instant alerts 30 minutes later. Pro can use `*/6` with four shards. No active QStash production schedules.
- HTTP: native `fetch` + per-adapter parsers (not Crawlee/Playwright at runtime).
- Local: `npm run scrape` and `npm run alerts:instant` (need `SUPABASE_SERVICE_ROLE_KEY`; alerts also need Resend env vars to send email).
- Adapters: `lib/scraping/registry.ts` keyed by `company_sources.source_type`.
- Full detail: [scraping.md](./scraping.md).

## UI conventions

- Default accent: **midnight** (`lib/config/accent.ts`, `user_preferences`). Other accents: indigo, rose.
- Company logos: static PNGs under `public/company-logos/`; misses use `/api/logo`.
- App shell: `components/app-shell/` (`shell.tsx`, `sidebar.tsx`, `top-bar.tsx`).
- Page structure: `PageShell` from `components/design-system/page.tsx`.
- Core controls: HeroUI-backed wrappers in `components/ui/`.
- Sonner for async feedback; Motion for subtle transitions only.
- Listing rows stay simple — avoid per-row animation flourishes.

## Testing

```bash
npm run test:unit          # Node unit tests (alerts, scrape, auth, feed, …)
npm run test:e2e           # Playwright public smoke (no credentials)
npm run verify             # lint + typecheck + audit + unit + build
npm run test:preprod:full  # verify + e2e
```

See [tests/README.md](../tests/README.md). Adapter regressions: `npm run scrape:audit-adapters`.

## Database changes

Remote Supabase migration history is authoritative. Workflow: [supabase/README.md](../supabase/README.md). Do not grep `supabase/migrations_archive/`.
