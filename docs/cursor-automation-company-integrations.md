# Cursor Automation: company integrations (50/day)

Hourly cloud agent that claims work from `docs/company-integration-queue.json`, integrates companies, verifies, opens **one PR per company**, and updates the queue.

## Throughput math

| Setting | Value |
|---------|--------|
| Daily target | 50 (`dailyTarget` in queue file) |
| Schedule | Every hour (`0 * * * *`) |
| Claim batch | 2 (`claimBatchSize`) |
| Runs × batch | 24 × 2 = **48/day** (raise batch to 3 or run extra manual claims to hit 50) |

To hit 50 exactly: set `claimBatchSize` to **3** in the queue JSON, or run `INTEGRATION_CLAIM_COUNT=3` in the automation environment.

## One-time setup

### 1. GitHub + Vercel (unchanged)

- Protect `main`; require PR + CI
- Vercel production branch = `main`; previews on feature branches

### 2. Initialize the queue (local, once)

```bash
npm run integration:queue -- init
npm run integration:queue -- sync
npm run integration:queue -- status
```

`init` adds the seed backlog. `sync` marks companies that already have `company_sources` migrations as `done`.

### 3. Curate the backlog

Edit `docs/company-integration-queue.json`:

- Set `autoApprove: true` on Greenhouse/Lever/Ashby rows once `boardToken` is confirmed
- Set `autoApprove: false` on hard custom ATS (Apple, Google, …) until you add `boardToken` / `notes`
- Add more slugs toward 500; keep `priority` lower = sooner

**Hourly agents only auto-claim `pending` + `autoApprove: true`.** Tier C rows need `--include-custom` or you flip `autoApprove` after research.

### 4. Create the automation

[cursor.com/automations](https://cursor.com/automations) → New automation:

| Field | Value |
|-------|--------|
| **Trigger** | Scheduled — cron `0 * * * *` (every hour) |
| **Repository** | `pathway` (this repo), base branch **`dev`** (not `main`) |
| **Tools** | Open pull request, Memories (optional), Send to Slack (optional) |
| **Secrets** | `SUPABASE_SERVICE_ROLE_KEY` in Cursor cloud agent secrets |

### 5. Automation prompt (paste into Cursor)

```markdown
You run the Pathway company integration hourly batch. Do not push to main.

## 1. Claim work
From repo root:
  npm run integration:queue -- claim --json
Parse the JSON. If `count` is 0, exit successfully with a short note (no PRs).

## 2. Per claimed slug (one company at a time)
For each entry in `slugs`:
- Branch: `integrate/company/<slug>` from latest **dev** (never reuse another slug's branch)
- Follow docs/agent-company-integration.md
- If queue row has `boardToken` / `tier`, use them; do not guess tokens
- Add migration + adapter/registry/tests as needed
- Apply Supabase migration via MCP when schema changes
- Run: npm run verify:integration -- <slug>
- Optional if secret available: npm run verify:integration -- <slug> --scrape
- Open a **separate PR to dev** per slug with verify output
- On success: npm run integration:queue -- complete <slug> --postings <N>
- On hard failure: npm run integration:queue -- block <slug> --reason "short reason"

## 3. Commit queue file
Include `docs/company-integration-queue.json` updates in each PR (or one queue PR if multiple slugs in one run—prefer one PR per slug for review).

## Rules
- US-only engineering internships only
- Never commit to `main` or `dev` directly (use `integrate/company/<slug>` branches)
- If verify fails after honest attempt, block and document; do not merge broken integrations
- Target quality over speed: 0 PRs is OK if nothing claimable
```

### 6. Optional second automation (Tier C research)

Schedule: `0 8 * * 1` (Monday 8am) or manual trigger  
Prompt: `npm run integration:queue -- claim --count 2 --custom-only --json` then same loop.

Use this for Apple/Google/Meta after you add hints to the queue.

## Operator commands

```bash
npm run integration:queue -- status
npm run integration:queue -- claim --count 3 --json
npm run integration:queue -- complete stripe --postings 14
npm run integration:queue -- block apple --reason "No public JSON API"
npm run integration:queue -- release-stale
```

## PR review at scale

Expect **up to ~50 small PRs/day**. Review in batches:

- Greenhouse PRs: verify CI + `verify:integration` output in description
- Merge quickly when checks are boringly green
- Blocked slugs stay out of the claim pool until you fix queue metadata

## Billing note

Hourly cloud agents bill per run. 24 runs/day × ~2 companies ≈ 48 agent sessions/day. Tune `claimBatchSize` and schedule if cost is high.
