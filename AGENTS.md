<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes -- APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent instructions

Pathway: Next.js 16, React 19, Supabase internship tracker. **Read this file first.**

## Documentation map

| Doc | Use for |
| --- | --- |
| [docs/README.md](docs/README.md) | Index |
| [docs/architecture.md](docs/architecture.md) | Routes, tables, Openings/Companies/Home, Scout, actions |
| [docs/alerts-filters.md](docs/alerts-filters.md) | Alert filter matching rules |
| [tests/README.md](tests/README.md) | Unit and e2e test layout |
| [docs/scraping.md](docs/scraping.md) | Scrape, adapters, company onboarding |
| [docs/discover-industries.md](docs/discover-industries.md) | `discover_industries` taxonomy; `companies.industry` FK |
| [docs/production-runbook.md](docs/production-runbook.md) | Deploy / incidents |
| [supabase/README.md](supabase/README.md) | Database changes |
| [discover-queue/README.md](discover-queue/README.md) | Bulk Discover onboarding |
| [.cursor/skills/discover-queue/SKILL.md](.cursor/skills/discover-queue/SKILL.md) | Discover queue worker steps |

Do **not** search `supabase/migrations_archive/` for current schema or whether a company exists.

## Required checks

- Next.js routes, layouts, metadata, Server Actions, `proxy.ts`, caching, Server Components → read `node_modules/next/dist/docs/` for that topic.
- Node.js **22.x**.
- Match patterns in `app/`, `components/`, `lib/actions/`, `lib/config/`, `lib/supabase/`.
- `npm run test:unit` / `npm run test:preprod` before claiming production readiness; `npm run test:preprod:full` includes public Playwright smoke tests (no credentials).
- `npm run verify` = `lint` + `test:preprod` (i.e. lint, typecheck, `npm audit`, unit tests, build).

## Discover queue

`npm run discover-queue` — see [discover-queue/README.md](discover-queue/README.md) and [.cursor/skills/discover-queue/SKILL.md](.cursor/skills/discover-queue/SKILL.md).

- `complete` with `openPostings: 0` is success.
- Custom adapters when standard ATS fails.
- `fail` only for missing env/MCP, migration/integrity failure, no scrapeable source, or scrape crash.
- Distinct `DISCOVER_QUEUE_WORKER` per parallel subagent.
- Catalog check: `npm run discover-queue -- catalog-check --slug <slug>`.

## Supabase database

**Hosted Supabase is authoritative.**

- Apply durable DDL/DML with MCP `apply_migration` (descriptive name, e.g. `add_acme_discover`).
- Inspect with `list_tables`, `execute_sql`, or `catalog-check` — not archive SQL greps.
- After apply: `list_migrations`, `select * from app_private.production_integrity_check();` (all `violations = 0`), advisors.
- `execute_sql` for read-only / QA / temporary checks — not durable DDL alone.
- Optional git file under `supabase/migrations/` only for review-worthy schema/RLS (`supabase migration new <name>`). Routine Discover seeds usually need no repo SQL.

## Security and data

- Privileged logic in narrow `app_private` RPCs or server-only modules.
- No secrets in `NEXT_PUBLIC_*`.
- Do not broaden RLS without a migration and clear reason.
- User data scoped by `auth.uid()` or trusted server lookup.
- Signup: open to any valid email + anti-abuse (format checks + disposable-domain blocklist in `lib/auth/validation.ts`).

## Product state

- Public signup enabled for any valid email (app-level format + disposable-domain checks only).
- Default accent: midnight (black). Accents: midnight, indigo, rose.
- Openings hides applied postings by default.
- Default post-login route: `/home`.
- Scout is locked for now (`SCOUT_ENABLED = false`); do not route users into `/chat` unless re-enabling it.
- Listing rows: simple, consistent across Openings/Companies/Applications (no row animation flourishes).
- Email alerts (`/alerts`) require `RESEND_API_KEY` + `RESEND_FROM_EMAIL` + `ALERT_UNSUBSCRIBE_SECRET` for outbound delivery.

## UI

- Prefer `components/ui/` primitives.
- Page shell: `PageShell`, `PageMain`, `PageHeader`, `PageSection` from `components/ui/page.tsx`.
- No new broad UI libraries (MUI, etc.) unless product asks.

## Docs maintenance

When changing architecture, env, scraping, or DB workflow, update the relevant file under `docs/` or `supabase/README.md`. Note migration name and verification in PR text when you apply remote migrations.
