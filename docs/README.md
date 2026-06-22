# Pathway documentation

Start here if you are setting up the repo, onboarding companies, or debugging production.

| Doc | Audience | Contents |
| --- | --- | --- |
| [../README.md](../README.md) | Everyone | Local setup, env vars, npm scripts, repo layout |
| [architecture.md](./architecture.md) | Engineers & agents | Routes, data model, Home, Openings, Companies, Scout, alerts, auth, testing |
| [scraping.md](./scraping.md) | Engineers & agents | Scrape runner, adapters, company onboarding |
| [discover-industries.md](./discover-industries.md) | Engineers & agents | Industry taxonomy (`discover_industries`) |
| [scraped-posted-dates.md](./scraped-posted-dates.md) | Engineers | Posted vs Discovered date provenance |
| [alerts-filters.md](./alerts-filters.md) | Engineers | Alert season/country/remote matching rules |
| [production-runbook.md](./production-runbook.md) | Release & on-call | Pre-deploy checks, env, incidents |
| [../supabase/README.md](../supabase/README.md) | Engineers & agents | Database change workflow (remote-first) |
| [../discover-queue/README.md](../discover-queue/README.md) | Operators | SQLite queue for bulk company onboarding |
| [../tests/README.md](../tests/README.md) | Engineers | Unit and e2e test layout |
| [../AGENTS.md](../AGENTS.md) | Coding agents | Required checks, DB rules, UI conventions |
| [llm-overview.md](./llm-overview.md) | LLMs & agents | Single-file project handoff: product, stack, data, subsystems |
| [../CLAUDE.md](../CLAUDE.md) | Claude / agents | Command cheat sheet and architecture snapshot |

## Terminology

| User-facing | Route | Code / data |
| --- | --- | --- |
| Home | `/home` | `lib/home/`, default after sign-in |
| Applications | `/applications` | Application tracker |
| Openings | `/openings` | `lib/feed/` — flat scraped role feed |
| Companies | `/companies` | `lib/discover/` — employer catalog |
| Alerts | `/alerts` | `lib/alerts/` |
| Scout | `/chat` | `lib/chat/`; locked while in progress |
| Settings | `/settings` | Account + appearance |

**Discover** in docs usually means the scrape catalog / onboarding workflow (`discover-queue`, `discover-company`, `discover_industries`), not a separate product route.

**Agent rule of thumb:** treat the **hosted Supabase project** as schema and catalog truth. Use `list_tables`, `execute_sql`, `npm run discover-company -- <flags>`, and `npm run discover-queue -- catalog-check --slug …` — not greps under `supabase/migrations_archive/`.
