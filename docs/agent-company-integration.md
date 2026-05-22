# Agent Company Integration Workflow

Scale target: **~50 companies/day** via hourly Cursor Automations + queue. See **`docs/cursor-automation-company-integrations.md`** for the scheduler setup.

## Queue-first workflow

### Default: direct Supabase apply (no PR)

For **Greenhouse / Lever / Ashby** rows with a confirmed `boardToken`:

```bash
npm run integration:queue -- run --count 1
# or: claim then apply
npm run integration:queue -- claim --count 1 --json
npm run integration:apply -- --claimed
```

This verifies live postings, upserts company + source + postings via `SUPABASE_SERVICE_ROLE_KEY`, marks the queue `done`, and optionally writes a migration file for the repo.

Optional: push queue/migration updates to `dev` without a PR:

```bash
INTEGRATION_COMMIT_DEV=1 npm run integration:queue -- run --count 1
```

### PR path (custom ATS only)

Custom tiers (Apple, Google, NVIDIA-style adapters) still need code in the repo:

```bash
npm run integration:queue -- claim --json
# branch integrate/company/<slug>, open PR to dev, then merge
```

On failure:

```bash
npm run integration:queue -- block <slug> --reason "why"
```

## Branching model

| Branch | Purpose | Vercel |
|--------|---------|--------|
| `main` | Production (stable) | **Production** — https://www.trypathway.app |
| `dev` | Integration / staging | **Preview** — https://dev.trypathway.app (also `pathway-git-dev-pathway-tracker.vercel.app`) |
| `integrate/company/<slug>` | One company per PR | **Preview** only (per-branch `*.vercel.app` URL) |

**Rule:** Agents and feature work merge into **`dev`**, not `main`. Promote `dev` → `main` only when staging is ready for production.

### GitHub + Vercel

1. Protect `main` — require PR; only accept merges from `dev` when releasing
2. Use **`dev`** as the base branch for integration PRs and hourly automations
3. Vercel **production branch** = `main` (unchanged). Pushes to **`dev`** deploy as Preview; stable staging URL = **https://dev.trypathway.app**
4. Cloud agent secrets: `SUPABASE_SERVICE_ROLE_KEY` (for `--scrape`)

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
8. PR to **`dev`** with verify output; update `docs/company-integration-queue.json`

## Tiering (in queue JSON)

| Tier | `autoApprove` | Hourly agent |
|------|---------------|--------------|
| Greenhouse / Lever / Ashby (token known) | `true` | Auto-claimed |
| `discover` / custom FAANG | `false` | Skipped unless `--include-custom` or you approve |

Curate `autoApprove` and `boardToken` in the queue file as you learn each ATS.

## CI

`.github/workflows/pr-checks.yml` — lint, typecheck, unit tests, static `verify:integration` for new migration slugs.

Live verify remains the agent’s job before opening a PR.
