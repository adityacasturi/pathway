# Discover onboarding queue

SQLite-backed queue for bulk onboarding employers into the Discover catalog. Workers follow [.cursor/skills/discover-queue/SKILL.md](../.cursor/skills/discover-queue/SKILL.md).

**Success = company + enabled scrape source + scrape exits 0.** Zero open intern postings today is still **complete**.

For one company at a time, prefer the direct hosted-Supabase CLI:

```bash
npm run discover-company -- --slug acme --name Acme --source-type greenhouse --source-url https://job-boards.greenhouse.io/acme
npm run discover-company -- --slug acme --name Acme --source-type greenhouse --source-url https://job-boards.greenhouse.io/acme --apply --scrape
```

## Human workflow

```bash
# 1. Add companies to discover-queue/inbox.json, then:
npm run discover-queue -- import

# 2. Check backlog
npm run discover-queue -- stats

# 3. Paste discover-queue/WORKER_PROMPT.md into Agent mode (optional: 10 parallel workers)
```

## Prerequisites

| Requirement | Why |
| --- | --- |
| `.env.local` with `SUPABASE_SERVICE_ROLE_KEY` | `npm run scrape`, `catalog-check` |
| Supabase MCP | New `source_type` migrations, schema/RLS migrations, integrity check |
| Node 22 | `package.json` engines |

## CLI

```bash
npm run discover-queue -- add --slug etsy --name Etsy --hints greenhouse --priority 5
npm run discover-queue -- import                    # default: discover-queue/inbox.json
npm run discover-queue -- claim                     # JSON; exit 2 if empty
npm run discover-queue -- catalog-check --slug etsy # DB truth; exit 0 if onboarded
npm run discover-queue -- heartbeat --id 3
npm run discover-queue -- complete --id 3 --result '{"migration":"add_etsy_discover",...}'
npm run discover-queue -- fail --id 3 --result '{"error":"...","stage":"probe"}'
npm run discover-queue -- list --status pending
npm run discover-queue -- stats
npm run company-logos -- --slug <slug>   # after onboard: static logo PNG + manifest
npm run discover-company -- --help        # preferred one-off onboarding flow
```

Environment: `DISCOVER_QUEUE_WORKER` — stable id per agent (`cursor-1`, …).

## Scrape verification

```bash
npm run scrape -- --dry-run --verbose <slug>
npm run scrape -- --verbose <slug>
```

See [docs/scraping.md](../docs/scraping.md). When writing `companies` rows, set `industry` to a slug from [docs/discover-industries.md](../docs/discover-industries.md).

## Files

| Path | Purpose |
| --- | --- |
| `inbox.json` | Backlog template (edit + import) |
| `queue.sqlite` | Runtime state (gitignored) |
| `WORKER_PROMPT.md` | Copy-paste for Composer |
| `.cursor/skills/discover-queue/SKILL.md` | Full worker pipeline |

Database workflow: [supabase/README.md](../supabase/README.md) — not local SQL greps.
