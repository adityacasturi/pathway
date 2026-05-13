# Production Runbook

## Pre-Deploy

- Use Node.js 22.x.
- Run `npm run verify`.
- Run public e2e with `npm run test:e2e`.
- Run authenticated e2e with `E2E_USER_EMAIL` and `E2E_USER_PASSWORD`.
- Run mutation e2e with `E2E_ALLOW_MUTATION=1` against a dedicated QA account.
- Confirm all new migrations have been applied through Supabase migration history, not only through raw SQL execution.
- Confirm `select * from app_private.production_integrity_check();` returns zero rows.
- Review Supabase security and performance advisors.
- Confirm production env vars are present and correctly scoped.

## Migration Procedure

For every durable database change:

1. Add a new append-only SQL file under `supabase/migrations/`.
2. Apply it with the Supabase connector `_apply_migration` tool or Supabase CLI migration flow.
3. Verify `_list_migrations` includes the new migration.
4. Run:

   ```sql
   select * from app_private.production_integrity_check();
   ```

5. Run Supabase advisors and record any accepted warnings.

Use `_execute_sql` or the SQL editor for inspection and emergency operations only. If an emergency operation changes durable schema or data rules, follow it with a proper migration that records the intended final state.

Known history note: some older migrations were manually applied in the SQL editor, so remote migration history may not include every old local file. Future changes should not continue that pattern.

## Environment

Required production variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_SITE_URL=https://...
```

Optional variables:

```bash
LOGO_DEV_TOKEN=...
RESEND_API_KEY=...
RESEND_AUDIENCE_ID=...
```

Rules:

- Resend keys are server-only.
- Never expose secrets with `NEXT_PUBLIC_`.
- Waitlist anti-abuse hashing uses a generated database secret in `app_private.waitlist_config`; do not truncate or replace that row during normal operations.

## Supabase Dashboard Checks

The connector can run migrations, SQL checks, migration listing, and advisors. The dashboard still needs manual review for product/auth settings:

- Auth signups disabled until the waitlist experiment ends.
- Email confirmation enabled before public signup returns.
- Password policy: minimum 8 characters plus lowercase, uppercase, digit, and symbol requirements.
- Leaked password protection enabled when the project plan supports it.
- Custom SMTP configured for production email.
- Site URL and redirect allow-list limited to real production/preview domains.
- Backups/PITR enabled for the project plan, with a restore drill documented.
- API grants and RLS reviewed after every migration.
- `public.waitlist` and `public.waitlist_attempts` not writable by `anon` or `authenticated`.
- Project runtime/platform posture checked for Supabase 2026 changes: supported Postgres version after July 1, 2026, and Node.js 22+ before Node.js 20 support ends on June 30, 2026.

Proposal for recurring checks: automate what the connector exposes in a release checklist (`_list_migrations`, integrity SQL, advisors), and keep dashboard-only items as a short manual launch gate. Do not block deploys on expected advisor noise such as unused indexes on brand-new zero-row tables; document why the warning is accepted.

## E2E Environment

Authenticated smoke:

```bash
E2E_USER_EMAIL="pathway.qa.20260513@uw.edu" \
E2E_USER_PASSWORD="..." \
npm run test:e2e
```

Mutation smoke:

```bash
E2E_USER_EMAIL="pathway.qa.20260513@uw.edu" \
E2E_USER_PASSWORD="..." \
E2E_ALLOW_MUTATION=1 \
npm run test:e2e
```

Use a dedicated QA account. Do not run mutation tests with a personal user.

## Incident Checks

- Check app logs for structured `launchpad` events: `server.boot`, `supabase.query_error`, `supabase.mutation_error`, and `feed.*`.
- Check Supabase Auth logs for spikes in failed sign-ins/signups.
- Check `public.rate_limits` for hot buckets.
- Check `public.waitlist_attempts` for abusive repeated hashed identifiers.
- Run the production integrity SQL after any manual database fix.
- If a manual SQL fix was durable, add a migration that records the intended final state.
