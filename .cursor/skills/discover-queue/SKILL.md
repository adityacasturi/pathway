---
name: discover-queue
description: >-
  Process the Discover company onboarding queue atomically. Onboard companies
  with standard or custom scrape adapters; apply migrations; verify scrape runs.
  Zero open internships today is success, not failure.
---
# Discover queue worker

You onboard companies from the queue: add each to the catalog with a **working scrape path**. You are **not** judging whether they are hiring interns right now.

**Batch size:** process **up to 3 companies per worker session** (3 claim → finish cycles). After each `complete` / `fail` / `skipped`, claim again unless you have finished 3 items or `claim` returns `claimed: null`.

## Success vs failure (read first)

| **`complete`** — company is onboarded | **`fail`** — blocked, cannot onboard |
|--------------------------------------|-------------------------------------|
| Migration applied + integrity check clean | Missing `SUPABASE_SERVICE_ROLE_KEY` or Supabase MCP |
| Scrape exits `0` (dry-run and live) | `apply_migration` or integrity check fails |
| Custom adapter implemented and registered when needed | No machine-readable careers source after documented attempts |
| **`openPostings: 0` is OK** | Adapter throws, HTTP hard-fails, or scrape exits non-zero |
| Board has jobs but none match intern/US filters today | Half-applied migration left without fix |

**Do not `fail` because:**

- No standard Greenhouse/Ashby/Lever/Workday token (→ build a **custom adapter**)
- Probe returns jobs but none are internships (→ still onboard; filters run at scrape time)
- Dry-run or live scrape finds **0 open intern postings** (→ `complete` with counts)
- Company is between intern seasons (→ `complete` with `openPostings: 0`)

---

## Prerequisites

- `.env.local`: `SUPABASE_SERVICE_ROLE_KEY` + Supabase URL/anon key
- Supabase MCP: `apply_migration`, `list_migrations`, `execute_sql`, `get_advisors`

Missing env/MCP → **`fail`** immediately (do not write migrations).

---

## Step 0 — Claim

```bash
DISCOVER_QUEUE_WORKER=<unique-id> npm run discover-queue -- claim
```

Save `claimed.id`, `claimed.slug`, `claimed.name`, `claimed.hints`, `claimed.notes`. Same worker id for heartbeat / complete / fail.

---

## Step 1 — Already in catalog?

```bash
npm run discover-queue -- catalog-check --slug <slug>
```

Exit `0` with `"inCatalog": true` (company has at least one **enabled** `company_sources` row) → `complete` with `{"skipped":true,"reason":"already in catalog"}` (counts toward your 3-item limit), then claim the next company if under 3.

Do **not** grep `supabase/migrations_archive/` — it is historical and excluded from agent context.

---

## Step 2 — Resolve scrape source (probe + custom adapter)

**Goal:** Pick `source_type`, `source_url`, `board_token`, and whether you need a **new adapter**.

### 2a — Try standard ATS (fast path)

Use `claimed.hints`, then tokens from `scripts/probe-discover-boards.ts`.

| Type | Probe |
|------|--------|
| `greenhouse` | `GET https://boards-api.greenhouse.io/v1/boards/<token>/jobs` |
| `ashby` | `GET https://api.ashbyhq.com/posting-api/job-board/<token>` |
| `lever` | `GET https://api.lever.co/v0/postings/<token>?mode=json` |
| `workday` | Workday CXS POST (see `scripts/probe-discover-boards.ts`) |

Also check: `workable`, `hiringthing`, `surge` — probe script and existing rows in `company_sources`.

**A standard board that returns HTTP 200 + a job list is enough to proceed** — even if zero titles look like internships.

### 2b — No standard board → custom adapter (required, not optional)

Do **not** `fail` just because GH/Ashby/Lever/Workday failed.

1. Open `careers_url` / company site; find JSON feeds, embedded hydration, RSS, or stable HTML lists.
2. Read similar adapters in `lib/scraping/adapters/` (e.g. `salesforce.ts`, `linkedin.ts`, `atlassian.ts`, `bloomberg.ts`, `jane-street.ts`, `lockheed-martin.ts`).
3. Implement `lib/scraping/adapters/<slug>.ts` (+ fixture under `tests/fixtures/scrape/` when practical).
4. Register in `lib/scraping/registry.ts`.
5. Extend `company_sources_source_type_check` in the apply_migration SQL when adding a new `source_type` (grep `lib/scraping/types.ts` and an existing adapter’s check constraint pattern in the archive only if needed).
6. Add tests in `tests/unit/scraping-adapters.test.ts`; run `npm run typecheck`.

**Only `fail` at probe** if you documented what you tried and there is **no** stable way to list jobs (e.g. login-only, CAPTCHA-only, no public listing). Put attempts in `result.probes`.

---

## Step 3 — Prepare SQL

Write SQL for `companies` + `company_sources` (`enabled = true`). Include `source_type` check updates when adding a custom adapter.

**Industry:** set `companies.industry` to a valid `discover_industries.slug` (FK). Pick the best match from [docs/discover-industries.md](../../docs/discover-industries.md); if unsure, use `enterprise-software`. Do not add TypeScript slug maps.

```sql
insert into public.companies (slug, name, website_url, careers_url, industry)
values ('<slug>', '<Name>', 'https://…', 'https://…/careers', 'devtools')
on conflict (slug) do update set
  industry = coalesce(public.companies.industry, excluded.industry),
  updated_at = now();
```

You do **not** need a file under `supabase/migrations/` for routine Discover seeds — remote migration history is enough. Add a git migration file only when the same PR changes schema/RLS that reviewers must see in GitHub.

---

## Step 4 — Apply migration (Supabase MCP)

1. `apply_migration` with a descriptive name (e.g. `add_<slug>_discover`).
2. `list_migrations` — confirm listed.
3. `select * from app_private.production_integrity_check();` → **0 rows** or fix forward / **`fail`**.
4. `get_advisors` — fix critical issues or note in `complete`.

---

## Step 5 — Dry-run scrape

```bash
npm run scrape -- --dry-run --verbose <slug>
```

| Result | Action |
|--------|--------|
| Exit `0` | Success — proceed (note `fetched` / `open` counts in logs; **0 is fine**) |
| Exit non-zero, stack trace, adapter missing | Fix adapter/registry, or **`fail`** with `stage: "dry-run"` |

Dry-run must not write `scraped_postings`. It validates the pipeline, not intern availability.

---

## Step 6 — Live scrape

```bash
npm run scrape -- --verbose <slug>
```

| Result | Action |
|--------|--------|
| Exit `0` | **`complete`** — include `openPostings` (may be `0`) |
| Exit non-zero | **`fail`** with `stage: "scrape"` |

Optional:

```sql
select count(*) from public.scraped_postings p
join public.companies c on c.id = p.company_id
where c.slug = '<slug>' and p.status = 'open';
```

---

## Step 7 — Complete

```bash
npm run discover-queue -- complete --id <id> --result '<json>'
```

**Example with zero open interns (still success):**

```json
{
  "migration": "add_github_discover",
  "migrationApplied": true,
  "sourceType": "lever",
  "boardToken": "github",
  "customAdapter": false,
  "dryRun": { "exitCode": 0, "fetched": 84, "open": 0 },
  "scrape": { "exitCode": 0, "openPostings": 0 },
  "note": "Board reachable; no US intern roles at scrape time",
  "integrityCheck": "ok"
}
```

**Example with new adapter:**

```json
{
  "migration": "add_arista_discover",
  "customAdapter": true,
  "adapterFile": "lib/scraping/adapters/arista.ts",
  "dryRun": { "exitCode": 0, "fetched": 120, "open": 0 },
  "scrape": { "exitCode": 0, "openPostings": 0 },
  "integrityCheck": "ok"
}
```

---

## Step 8 — Fail (narrow)

```bash
npm run discover-queue -- fail --id <id> --result '{"error":"...","stage":"probe|migration|apply|dry-run|scrape","probes":[...]}'
```

Use **`fail`** only for blockers in the table at the top — not for empty intern results.

---

## Checklist (per company)

```
[ ] claim
[ ] not already seeded
[ ] source resolved (standard ATS OR custom adapter implemented)
[ ] SQL prepared (catalog + source_type if needed)
[ ] apply_migration + integrity 0 rows
[ ] scrape --dry-run exits 0 (0 open OK)
[ ] scrape exits 0 (0 open OK)
[ ] complete/fail with counts + note if openPostings=0
[ ] if finished < 3 items and queue not empty → claim again
```

---

## Worker loop (up to 3 companies)

Use the **same** `DISCOVER_QUEUE_WORKER` for every claim in this session.

```
processed = 0
while processed < 3:
  claim → if null, break
  run Steps 1–7 for claimed company
  processed += 1
```

Stop early when the queue is empty. Do not claim a 4th company in the same session.

---

## Parent agent: parallel dispatch

Launch **10** background **generalPurpose** subagents with ids `cursor-1` … `cursor-10` in **one** parent message (parallel Task calls).

Each subagent:

- Uses **only** its own `DISCOVER_QUEUE_WORKER` (never share ids).
- Follows this skill for **up to 3** companies (loop above).
- Stops when `claim` returns null or after 3 finished items.

**Throughput:** up to **30** companies per batch when `pending ≥ 30`. If `pending` is lower, some workers finish fewer than 3 — that is expected.

> Onboard means catalog + scrape path works. **Zero intern postings today is `complete`, not `fail`.** Build a custom adapter when standard ATS does not fit.

Parent runs first:

```bash
npm run discover-queue -- import
npm run discover-queue -- stats
```

Report pending count before launching; if `pending < 10`, still launch 10 workers (idle workers exit on first empty `claim`).
