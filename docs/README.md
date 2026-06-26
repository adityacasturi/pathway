# Pathway documentation

| Doc | Contents |
| --- | --- |
| [../README.md](../README.md) | Local setup, env vars, npm scripts |
| [architecture.md](./architecture.md) | Routes, data model, feeds, alerts, auth |
| [scraping.md](./scraping.md) | Scrape runner, adapters, company onboarding |
| [discover-industries.md](./discover-industries.md) | Industry taxonomy (`discover_industries`) |
| [scraped-posted-dates.md](./scraped-posted-dates.md) | Posted vs first-seen date semantics |
| [alerts-filters.md](./alerts-filters.md) | Alert season/country/remote matching |
| [production-runbook.md](./production-runbook.md) | Deploy and incident checks |
| [../supabase/README.md](../supabase/README.md) | Database change workflow |
| [../discover-queue/README.md](../discover-queue/README.md) | Bulk company onboarding queue |
| [../tests/README.md](../tests/README.md) | Unit and e2e tests |
| [../AGENTS.md](../AGENTS.md) | Rules for coding agents |
| [../CLAUDE.md](../CLAUDE.md) | Agent command cheat sheet |

## Terminology

| User-facing | Route | Code / data |
| --- | --- | --- |
| Home | `/home` | `lib/home/` |
| Applications | `/applications` | Application tracker |
| Openings | `/openings` | `lib/feed/` |
| Companies | `/companies` | `lib/discover/` |
| Alerts | `/alerts` | `lib/alerts/` |
| Settings | `/settings` | Account + appearance |

**Discover** in docs means the scrape catalog / onboarding workflow (`discover-queue`, `discover-company`, `discover_industries`).

**Schema truth:** hosted Supabase + `list_migrations`. Do not grep `supabase/migrations_archive/`.
