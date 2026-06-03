# 2026-06-03 Codebase Audit

Scope: alerts, auth/session boundaries, Supabase RLS/grants/RPCs, browser persistence, cron/deployment assumptions, and documentation drift.

## Fixed In This Pass

- Removed ignored Finder duplicate `app/api/cron/send-instant-alerts/route 2.ts`; it was byte-for-byte identical to the canonical route and ignored by `.gitignore`.
- Added one-time import/clear helpers for legacy Live/Discover/Application browser view keys in `lib/user-preferences/legacy-view-storage.ts`.
- Updated Live and Applications pages to clear legacy `localStorage` keys after a successful `user_preferences` sync, preventing stale browser state from overriding Supabase on every visit.
- Marked historical alert plan/spec docs as superseded and updated integrity-check wording to match production's named `violations` rows.
- Applied hosted Supabase migration `drop_legacy_alert_write_rpcs` after confirming app code no longer uses the legacy public alert write RPCs.
- Applied hosted Supabase migration `harden_alert_client_write_policies` so `alert_preferences` and `alert_subscriptions` are client read-only; writes go through server actions.
- Applied hosted Supabase migration `harden_alert_table_grants` to remove non-read client grants across alert tables, including TRUNCATE/trigger/reference privileges.
- Applied hosted Supabase migration `harden_discover_industries_grants` so the Discover industry taxonomy is authenticated read-only for clients.
- Updated stale public e2e assertions to match the current landing page and fixed a mobile landing header/hero overflow found during e2e verification.

## Production Supabase Snapshot

- `app_private.production_integrity_check()` returned 11 named checks, all with `violations = 0`.
- Alert subscription target types in production are `company` and `sector`; no invalid/legacy `industry` rows remain.
- All public tables have RLS and policies.
- No public `SECURITY DEFINER` functions remain after dropping the legacy alert write RPCs.
- Supabase security advisor still reports `auth_leaked_password_protection` disabled.
- Supabase performance advisor still reports `discover_company_favorites_company_id_idx` as unused.

## Vercel Snapshot

- Project `pathway` is linked to Vercel project `prj_O68SmAhvd1vBi7DYOPCztezd59N3`.
- Vercel project Node runtime is `22.x`, matching repo requirements.
- Latest production deployments are `READY`.
- Production cron behavior is QStash-managed through `/api/cron/*` routes, not `vercel.json`.
- The available Vercel connector did not expose environment-variable listing, so env presence was checked from local `.env.local` names and runbook expectations, not remote values.

## Remaining Risks / Backlog

1. Enable Supabase Auth leaked-password protection in the dashboard. This cannot be changed safely through code in this pass.
2. Decide whether to move `applications`, `application_events`, `feed_interactions`, `discover_company_favorites`, and `user_preferences` writes fully behind service-role server actions. They currently rely on authenticated client grants plus RLS; this matches existing action code but still allows direct same-user table writes outside app validation/rate limits.
3. Keep `discover_company_favorites_company_id_idx` for now. The advisor marks it unused, but it covers a foreign key and a likely future query path; dropping it is low value unless write overhead becomes measurable.
4. Historical migration files under `supabase/migrations/` still show earlier alert `industry` target definitions. They are immutable history; hosted Supabase and current docs are authoritative.
5. Supabase CLI is not installed locally, so the hosted schema/RLS migrations applied in this pass do not have generated local SQL review files. This is acceptable per `supabase/README.md` for routine hosted changes, but schema-review workflows should install the CLI first.

## Verification Run During Audit

- Focused unit tests: `alert-match-postings.test.ts` and `legacy-view-storage.test.ts` passed.
- Full e2e suite passed with 14 tests passing and 8 authenticated tests skipped because no `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` values were present locally.
- Supabase migration list confirmed latest hosted migrations through `harden_discover_industries_grants`.
- Supabase integrity check passed after each migration (`violations = 0` on every row).
- Supabase security and performance advisors were run after the final migration.
