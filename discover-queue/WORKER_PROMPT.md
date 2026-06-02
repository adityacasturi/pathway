# Copy-paste into Composer (Agent mode)

Use this after `npm run discover-queue -- import`.

---

Process the Discover onboarding queue with **10 parallel workers**, **up to 3 companies each** (max **30** per batch when the queue is full enough).

## Important rules

- **Onboard** = company + scrape source in DB, scrape command exits 0.
- **`complete` even when `openPostings` is 0** — no internships listed today is normal.
- **Do not `fail`** because GH/Ashby/Lever/Workday failed — **implement a custom adapter** (see `lib/scraping/adapters/`).
- **`fail` only** for: missing env/MCP, migration/integrity errors, no scrapeable careers source after real investigation, or scrape crashes (non-zero exit).
- Each worker processes **at most 3** companies, then stops (or stops early if the queue is empty).

## Setup

```bash
npm run discover-queue -- import
npm run discover-queue -- stats
```

Note `pending`. You need `pending ≥ 1` to start; workers that find an empty queue exit immediately on `claim`.

## Launch workers (parent does this)

In **one message**, start **10 background `generalPurpose` subagents** in parallel.

| Worker id | `DISCOVER_QUEUE_WORKER` |
|-----------|-------------------------|
| 1 | `cursor-1` |
| 2 | `cursor-2` |
| … | … |
| 10 | `cursor-10` |

**Paste this to each subagent** (replace `cursor-N`):

> You are discover-queue worker **cursor-N**.
> Follow `.cursor/skills/discover-queue/SKILL.md`.
>
> Use `DISCOVER_QUEUE_WORKER=cursor-N` for every claim/complete/fail.
>
> **Loop up to 3 times:**
> 1. `npm run discover-queue -- claim` — if `claimed` is null, stop.
> 2. Onboard that company (probe or custom adapter → migration → apply_migration → integrity check → dry-run scrape → live scrape → complete/fail).
> 3. Repeat until you have finished **3** companies or `claim` returns null.
>
> Do not claim a 4th company. Do not share worker ids with other subagents.

Requires `SUPABASE_SERVICE_ROLE_KEY` and Supabase MCP.

## When all workers finish

Summarize in a table (one row per company processed):

| slug | worker | done/failed/skipped | migration name (remote) | custom adapter? | open postings | note |

Also report: `npm run discover-queue -- stats`

---

## Single-worker version (no parallel)

```
Follow .cursor/skills/discover-queue/SKILL.md.

DISCOVER_QUEUE_WORKER=solo npm run discover-queue -- import

Loop up to 3 times: claim → onboard → complete/fail until claim is null or 3 items finished.
Summarize at the end.
```
