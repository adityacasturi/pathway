---
name: scrape-audit
description: >-
  Browser-first audit of scraped internship coverage. Shard enabled companies
  across parallel subagents; each compares live careers pages to Pathway data
  and fixes adapter discrepancies.
---
# Scrape coverage audit (browser + subagents)

Verify every enabled `company_sources` row by browsing live careers pages and comparing to Pathway's open `scraped_postings`. **Browser is ground truth** — do not use `npm run scrape:audit` as verification.

## Orchestrator (parent agent)

1. Load catalog (read-only SQL):
   ```sql
   select c.slug, c.name, cs.source_type, cs.source_url, cs.adapter_key,
          cs.board_token, cs.scrape_health_status,
          (select count(*) from scraped_postings p
           where p.company_id = c.id and p.status = 'open') as open_count
   from companies c
   join company_sources cs on cs.company_id = c.id
   where cs.enabled = true
   order by c.name;
   ```

2. **Priority order**
   - `scrape_health_status = 'suspicious_zero'` or latest `scrape_runs.attention`
   - `open_count > 0` (verify accuracy of stored roles)
   - `open_count = 0` (find missing internships)

3. **Shard** into 4–8 non-overlapping alphabet batches. Assign shared adapters (ByteDance/TikTok, VMware/Splunk/Juniper Workday) to one subagent only.

4. Write shard JSON under `.cursor/audit-shards/`:
   - `audit-shard-{0..N}.json` — companies with `open_count > 0`
   - `zero-shard-{0..7}.json` — companies with `open_count = 0`
   - `audit-all.json` — full enabled catalog

5. Launch parallel `generalPurpose` subagents (one Task per batch, **single parent message**):
   - Wave 1: `open_count > 0` shards + one priority agent (`suspicious_zero`, likely-hiring zero-open)
   - Wave 2: `zero-shard-*` batches

6. Merge subagent report tables; dedupe shared-adapter fixes; run `npm run test:unit` once.

### Subagent prompt (template)

```
Repo: /Users/adityacasturi/Documents/Projects/internship-tracker
Supabase project_id: vfcithtpstkipchvqlnd
Batch file: .cursor/audit-shards/<shard>.json

Browser-first audit each slug: live source_url vs Pathway open postings (SQL read-only).
Fix lib/scraping/adapters/ + tests on mismatch. Re-check in browser after fix.
Do NOT use npm run scrape:audit as verification.

Return markdown table per slug (OK|FIXED|DISCREPANCY|BLOCKED) + summary counts.
Read docs/scraping.md for employer quirks.
```

## Subagent workflow (per slug)

1. **Pathway state:** browser → `/companies` for slug, or read-only `scraped_postings` SQL.
2. **Live site:** browser → `source_url` (or documented redirect in `docs/scraping.md`).
3. Enumerate visible **engineering intern/co-op** roles (`lib/scraping/classify-role.ts`).
4. Compare: missing · extra · stale · wrong URL/metadata · wrong source.
5. Fix `lib/scraping/adapters/*.ts` + tests; re-check in browser.
6. Blockers (403, CAPTCHA, login): document, do not guess.

## Report template

| slug | status | site_count | pathway_count | issues | fix/files | blocker |
|------|--------|------------|---------------|--------|-----------|---------|

Status: `OK` · `FIXED` · `DISCREPANCY` · `BLOCKED`

## Terminal (fixes only)

```bash
npm run test:unit
npm run scrape -- <slug>   # optional: persist after browser confirms
```

## Done

- [ ] Every enabled slug checked in browser
- [ ] Discrepancies fixed or blockers documented
- [ ] Unit tests pass for touched adapters
