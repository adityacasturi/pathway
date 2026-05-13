# Production Runbook

## Pre-Deploy

- Run `npm run verify`.
- Run `npm run test:e2e` for anonymous/header checks.
- Run authenticated E2E against a staging/test user with `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`, and optionally `E2E_ALLOW_MUTATION=1`.
- Apply Supabase migrations in order and confirm `select * from app_private.production_integrity_check();` returns zero violations from the SQL editor or service-role context.
- Confirm the latest Supabase migration version is present in the dashboard migration history.
- Run Supabase security and performance advisors. Performance advisors should be clean; the remaining Auth leaked-password warning is expected on non-Pro projects.

## Supabase Dashboard Settings

These are not exposed by the current Codex Supabase connector, so verify them in the Supabase dashboard before launch:

- Auth password policy: minimum 8 characters, lowercase, uppercase, digits, and symbols required, leaked password protection enabled when available.
- Email confirmation enabled.
- Custom SMTP configured for production email.
- Site URL and redirect allow-list restricted to production and preview domains you actually use.
- Backups/PITR enabled for the project plan, with a documented restore drill.

## E2E Environment

```bash
E2E_USER_EMAIL="qa@example.com" \
E2E_USER_PASSWORD="..." \
npm run test:e2e
```

Mutation smoke tests are opt-in:

```bash
E2E_ALLOW_MUTATION=1 npm run test:e2e
```

Use a dedicated QA account for mutation tests.

## Incident Checks

- Check app logs for structured `launchpad` events: `server.boot`, `supabase.query_error`, `supabase.mutation_error`, and `feed.*`.
- Check Supabase Auth logs for spikes in failed sign-ins/signups.
- Check `public.rate_limits` for hot buckets.
- Run the production integrity SQL after any manual database fix.
