# Pathway documentation

Start here if you are setting up the repo, onboarding Discover companies, or debugging production.

| Doc | Audience | Contents |
| --- | --- | --- |
| [../README.md](../README.md) | Everyone | Local setup, env vars, npm scripts, repo layout |
| [architecture.md](./architecture.md) | Engineers & agents | Routes, data model, Home briefing, Live/Discover/Stats feeds, email alerts, auth, testing |
| [discover-industries.md](./discover-industries.md) | Engineers & agents | Discover industry taxonomy (`discover_industries`) |
| [scraping.md](./scraping.md) | Engineers & agents | Scrape runner, adapters, filters, onboarding |
| [scraped-posted-dates.md](./scraped-posted-dates.md) | Engineers | Posted vs Discovered date provenance |
| [production-runbook.md](./production-runbook.md) | Release & on-call | Pre-deploy checks, env, incidents |
| [../supabase/README.md](../supabase/README.md) | Engineers & agents | Database change workflow (remote-first) |
| [../discover-queue/README.md](../discover-queue/README.md) | Operators | SQLite queue for bulk company onboarding |
| [../AGENTS.md](../AGENTS.md) | Coding agents | Required checks, DB rules, UI conventions |
| [../CLAUDE.md](../CLAUDE.md) | Claude / agents | Command cheat sheet and architecture snapshot |

**Agent rule of thumb:** treat the **hosted Supabase project** as schema and catalog truth. Use `list_tables`, `execute_sql`, and `npm run discover-queue -- catalog-check --slug …` — not greps under `supabase/migrations_archive/`.
