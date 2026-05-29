# Pathway

Pathway is a focused internship search workspace for students with `.edu` email addresses. Public signup is enabled; authenticated users can track applications, manage event timelines, review stats, and browse live internship postings in Discover.

Built with Next.js 16 App Router, React 19, Server Actions, Supabase Auth/Postgres/RLS, Tailwind CSS v4, Playwright, and shadcn-style UI primitives on `@base-ui/react`.

## Requirements

- Node.js 22.x
- npm 10.x
- A Supabase project with the migrations in `supabase/migrations/` formally applied

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local`:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   NEXT_PUBLIC_SITE_URL=http://localhost:3000

   # Optional: cached company logos via https://logo.dev.
   LOGO_DEV_TOKEN=...

   ```

3. Apply database migrations through the Supabase connector/CLI migration flow. Do not paste durable DDL into the SQL editor as an ad hoc change; see [Agent And Migration Rules](#agent-and-migration-rules).

4. Start the app:

   ```bash
   npm run dev
   ```

   Visit [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the local Next.js dev server |
| `npm run build` | Create a production build |
| `npm run start` | Start the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm run test:e2e` | Run Playwright e2e tests |
| `npm run test:e2e:ui` | Run Playwright in UI mode |
| `npm run verify` | Lint, typecheck, audit, and build |

Authenticated e2e tests require a QA account:

```bash
E2E_USER_EMAIL="pathway.qa.20260513@uw.edu" \
E2E_USER_PASSWORD="..." \
npm run test:e2e
```

Mutation coverage is opt-in and intentionally single-worker because it uses one shared QA account:

```bash
E2E_USER_EMAIL="pathway.qa.20260513@uw.edu" \
E2E_USER_PASSWORD="..." \
E2E_ALLOW_MUTATION=1 \
npm run test:e2e
```

## Project Layout

```text
app/                  Next.js routes, layouts, loading/error states, logo API
components/           Product UI for landing, app shell, dashboard, discover, stats
components/ui/        Reusable primitives
lib/actions/          Server Actions for auth, apps, events, feed, settings
lib/auth/             Signup state and auth validation rules
lib/config/           Event/status, deadlines, accent theme, application state helpers
lib/feed/             Upstream internship feed ingestion and normalization
lib/supabase/         Browser/server Supabase client factories and error helpers
supabase/migrations/  Append-only database migrations
tests/e2e/            Playwright public and authenticated smoke tests
types/                Shared TypeScript domain types
```

See [docs/architecture.md](./docs/architecture.md) for the system walkthrough and [docs/production-runbook.md](./docs/production-runbook.md) for launch checks.

## Agent And Migration Rules

- Read `AGENTS.md` before making changes. For Next.js work, read the relevant guide in `node_modules/next/dist/docs/` first.
- Every database schema, RLS, function, trigger, grant, index, or durable data backfill change must be represented as a new append-only file in `supabase/migrations/`.
- Apply durable database changes with the Supabase connector migration tool (`_apply_migration`) or the Supabase CLI migration flow so the migration appears in the Supabase migration list.
- Use raw SQL execution only for read-only inspection, one-off QA account setup, and temporary checks. Do not use the SQL editor or `_execute_sql` for production DDL that should be tracked as a migration.
- After applying migrations, verify `_list_migrations`, run `select * from app_private.production_integrity_check();`, and review Supabase advisors.

## Production Notes

- Public signup requires a `.edu` email.
- Default UI accent is midnight. User preferences are stored in `public.user_preferences`.
- Supabase dashboard checks that are not fully automatable from this repo still matter: Auth password policy, email confirmation, SMTP, redirect allow-list, leaked password protection, backups/PITR, and advisor review.
