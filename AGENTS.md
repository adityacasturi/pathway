<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes -- APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent Instructions

Pathway is a Next.js 16, React 19, Supabase-backed internship tracker. Treat this file as the first stop for agents working in the repo.

## Required Checks

- Before editing Next.js routes, layouts, metadata, Server Actions, proxy behavior, caching, or Server Components, read the relevant local docs in `node_modules/next/dist/docs/`.
- Use Node.js 22.x. The production target and Supabase platform guidance assume Node 22.
- Prefer existing patterns in `app/`, `components/`, `lib/actions/`, `lib/config/`, and `lib/supabase/`.
- Run focused checks while working and `npm run verify` before claiming production readiness when feasible.
- For e2e, run `npm run test:e2e`; set `E2E_USER_EMAIL` and `E2E_USER_PASSWORD` for authenticated coverage, and `E2E_ALLOW_MUTATION=1` for mutation smoke tests.

## Supabase Migration Rules

Formal migrations are mandatory.

- Add a new append-only SQL file in `supabase/migrations/` for every schema, RLS policy, database function, trigger, grant, index, constraint, or durable data backfill.
- Apply durable database changes with the Supabase connector `_apply_migration` tool, or an equivalent Supabase CLI migration command, using the same migration name as the file. This is what makes the change appear in Supabase's migration list.
- Do not paste production DDL into the Supabase SQL editor as the only record of the change.
- Do not use `_execute_sql` for durable DDL. Reserve it for read-only inspection, temporary verification, and one-off operational tasks such as QA account setup.
- After applying a migration, check `_list_migrations`, run `select * from app_private.production_integrity_check();`, and review security/performance advisors.
- If remote history is missing older migrations because they were manually applied, do not rewrite existing migration files. Add new migrations going forward and document any drift in the runbook or PR notes.

## Security And Data Rules

- Keep privileged database logic in narrow private-schema RPCs or server-only modules.
- Never expose Resend keys or other secrets through `NEXT_PUBLIC_` variables.
- RLS is part of the product contract. Do not broaden grants or policies without a migration and a clear reason.
- Authenticated user data must remain scoped by `auth.uid()` or trusted server-side user lookup.
- Waitlist writes require `@uw.edu`, durable anti-abuse checks, and hashed identifiers for IP/email rate-limit metadata. The app calls only `public.join_waitlist`; table writes and HMAC hashing happen inside `app_private.join_waitlist`.

## Product State

- Public account creation is intentionally disabled while the waitlist is being measured.
- Default accent theme is sage.
- Discover hides applied postings by default.
- Dashboard rows should stay simple and consistent with Discover rather than adding page-row animation flourishes.

## Documentation

- Keep `README.md`, `docs/architecture.md`, and `docs/production-runbook.md` current when changing architecture, setup, database workflow, env vars, or launch checks.
- If you add a migration, mention the verification performed and whether it has been applied remotely.
