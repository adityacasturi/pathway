# Agent Company Integration Workflow

Scale target: **~50 companies/day** via hourly Cursor Automations + queue. See **`docs/cursor-automation-company-integrations.md`** for the scheduler setup.

## Queue-first workflow

```bash
# Operator / automation starts here
npm run integration:queue -- claim --json
```

Each claimed slug gets its own branch: `integrate/company/<slug>` (one PR per company).

After verify + PR:

```bash
npm run integration:queue -- complete <slug> --postings <count>
# or on failure:
npm run integration:queue -- block <slug> --reason "why"
```

## Branching model

| Branch | Purpose | Vercel |
|--------|---------|--------|
| `main` | Production | **Production** deployment |
| `integrate/company/<slug>` | One company per PR | **Preview** only |

**Rule:** Agents never push to `main`.

### GitHub + Vercel

1. Protect `main` — require PR + `PR checks` CI
2. Vercel production branch = `main`; previews on other branches
3. Cloud agent secrets: `SUPABASE_SERVICE_ROLE_KEY` (for `--scrape`)

## Verification

```bash
npm run verify:integration -- <slug>
npm run verify:integration -- <slug> --scrape   # needs service role key
VERIFY_MIN_FOUND=3 npm run verify:integration -- <slug>
```

| Check | Meaning |
|-------|---------|
| `migration_source` | `company_sources` in a migration |
| `scrape_registry` | Uses `lib/scraping/registry.ts` |
| `live_fetch` | ≥ `VERIFY_MIN_FOUND` US engineering internships |
| `supabase_scrape` | Optional upsert succeeds |

## Implementation checklist (per slug)

1. Read queue row (`tier`, `boardToken`, `careersUrl`)
2. Discover real ATS — do not guess Greenhouse tokens
3. Custom: `lib/scraping/adapters/<slug>.ts` + `lib/scraping/registry.ts`
4. Standard: migration with greenhouse/lever/ashby `company_sources`
5. `supabase/migrations/NNN_add_<slug>_....sql` + apply via Supabase MCP
6. Tests in `tests/unit/ats-adapters.test.ts`
7. `npm run verify:integration -- <slug>`
8. PR to `main` with verify output; update `docs/company-integration-queue.json`

## Tiering (in queue JSON)

| Tier | `autoApprove` | Hourly agent |
|------|---------------|--------------|
| Greenhouse / Lever / Ashby (token known) | `true` | Auto-claimed |
| `discover` / custom FAANG | `false` | Skipped unless `--include-custom` or you approve |

Curate `autoApprove` and `boardToken` in the queue file as you learn each ATS.

## CI

`.github/workflows/pr-checks.yml` — lint, typecheck, unit tests, static `verify:integration` for new migration slugs.

Live verify remains the agent’s job before opening a PR.
