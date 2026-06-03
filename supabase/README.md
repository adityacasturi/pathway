# Database workflow

Production schema and migration history live on the **hosted Supabase project**. The dashboard and MCP `list_migrations` show what is applied.

## Quick reference

| Task | How |
| --- | --- |
| See tables/columns | MCP `list_tables` or SQL editor |
| Is a Discover company onboarded? | `npm run discover-queue -- catalog-check --slug <slug>` |
| Add one Discover company/source | `npm run discover-company -- <flags>` dry-run, then repeat with `--apply --scrape` |
| Industry slugs for `companies.industry` | [docs/discover-industries.md](../docs/discover-industries.md) (`discover_industries` table) |
| Apply a durable change | MCP `apply_migration` with a descriptive name |
| Verify | `list_migrations`, `select * from app_private.production_integrity_check();` (all `violations = 0`), advisors |
| Optional code review SQL | `supabase migration new <name>` → one file in `supabase/migrations/` |

## Agents

1. Do **not** grep `supabase/migrations_archive/` — historical only, excluded from Cursor.
2. Do **not** invent `NNN_description.sql` filenames.
3. Use `execute_sql` for inspection, not as the only record of production DDL.
4. Routine Discover company/source onboarding should use `npm run discover-company -- <flags> --apply --scrape`; it does not need a migration.
5. **Schema / RLS / new `source_type`:** `apply_migration` plus optional git file for PR review.

## Local development

Point `.env.local` at the shared project (or a Supabase branch). Clone + install + dev — no need to replay archived SQL.

Required keys: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (scrapes).

## Archive

`migrations_archive/` holds ~180 legacy SQL files from early development (per-company seeds, old schema steps). Kept for archaeology only. Production state = remote project.

## Integrity check

After every migration:

```sql
select * from app_private.production_integrity_check();
```

Any row with `violations > 0` is a blocker until fixed forward or reverted via a new migration.

## Recent hosted migrations

- `add_market_summary_rpcs_and_favorite_index` — adds `discover_company_open_counts()`, `market_posting_summary(_now)`, the missing `discover_company_favorites(company_id)` FK index, and a partial open-US postings index for the aggregate path.
- `triage_failing_discover_sources` — disables Tesla and TransMarket Group sources after repeated hosted scrape failures; re-enable only after a replacement source/adapter passes dry-run verification.
- `allow_fifteen_minute_scrape_interval` — lowers `company_sources.scrape_interval_minutes` default/check constraint to 15 minutes so production can run sub-hourly schedules.
- `deny_client_access_to_unsubscribe_nonces` — adds an explicit deny-all RLS policy for `alert_unsubscribe_nonces`; writes stay service-role only.
- `add_pinpoint_source_type_and_wolverine_source` — registers the `pinpoint` source type and moves Wolverine Trading from a stale Lever board to `https://careers.wolve.com/en/postings.json`.
- `revoke_authenticated_alert_write_rpcs` — revokes signed-in client `EXECUTE` on legacy alert write RPCs after moving `/alerts` mutations behind scoped server actions.
- `remove_industry_alert_subscriptions` — deletes legacy `industry` alert subscriptions and tightens alert target validation to `company` / `sector`.
- `drop_legacy_alert_write_rpcs` — drops the now-unused public alert write RPCs after verifying `/alerts` uses scoped server actions and client execution had already been revoked.
- `harden_alert_client_write_policies` — replaces alert preference/subscription "manage own" policies with read-only client policies so writes must go through server actions.
- `harden_alert_table_grants` — revokes non-read client table privileges across alert tables; service-role cron/actions retain the required write access.
- `harden_discover_industries_grants` — revokes non-read client privileges from the Discover industry taxonomy; authenticated clients keep read access only.
