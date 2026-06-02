# Database workflow

Production schema and migration history live on the **hosted Supabase project**. The dashboard and MCP `list_migrations` show what is applied.

## Quick reference

| Task | How |
| --- | --- |
| See tables/columns | MCP `list_tables` or SQL editor |
| Is a Discover company onboarded? | `npm run discover-queue -- catalog-check --slug <slug>` |
| Industry slugs for `companies.industry` | [docs/discover-industries.md](../docs/discover-industries.md) (`discover_industries` table) |
| Apply a durable change | MCP `apply_migration` with a descriptive name |
| Verify | `list_migrations`, `select * from app_private.production_integrity_check();` (0 rows), advisors |
| Optional code review SQL | `supabase migration new <name>` → one file in `supabase/migrations/` |

## Agents

1. Do **not** grep `supabase/migrations_archive/` — historical only, excluded from Cursor.
2. Do **not** invent `NNN_description.sql` filenames.
3. Use `execute_sql` for inspection, not as the only record of production DDL.
4. Discover **company seeds** usually need only `apply_migration` on remote, not a git SQL file.
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

Any row returned is a blocker until fixed forward or reverted via a new migration.
