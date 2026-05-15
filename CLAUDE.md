# CLAUDE.md

Guidance for Claude Code and other coding agents working on Pathway.

## Commands

```bash
npm run dev          # local dev server
npm run build        # production build
npm run start        # start production build
npm run lint         # ESLint
npm run typecheck    # TypeScript
npm run test:e2e     # Playwright e2e
npm run verify       # lint, typecheck, audit, build
```

Authenticated e2e requires `E2E_USER_EMAIL` and `E2E_USER_PASSWORD`. Mutation tests require `E2E_ALLOW_MUTATION=1`; the Playwright config uses one worker in that mode because tests share a QA account.

## Next.js 16 Note

This project uses Next.js 16. Read the relevant local guide in `node_modules/next/dist/docs/` before changing routing, Server Components, Server Actions, metadata, caching, `proxy.ts`, or build/runtime behavior.

## Architecture Snapshot

Pathway is an internship tracker and discover feed for UW students. Public signups are paused; the waitlist accepts `@uw.edu` emails only. Authenticated users sign in with Supabase Auth and manage applications through event timelines.

Core surfaces:

- `/` public landing page and waitlist
- `/login` sign in and paused signup UI
- `/home` authenticated overview
- `/applications` tracker table and detail modal
- `/discover` live internship feed
- `/stats` recruiting metrics
- `/settings` account and accent preferences

## Data Model

Important Supabase tables:

- `applications`: per-user application rows, archived state, posting URL, status snapshot
- `application_events`: per-application timeline events and OA deadlines
- `feed_interactions`: per-user saved/dismissed discover posting ids
- `user_preferences`: accent color and discover cutoff preferences
- `waitlist`: raw waitlist email rows, written only by the narrow waitlist RPC
- `waitlist_attempts`: hashed email/IP anti-abuse records for waitlist submissions
- `rate_limits`: private backing table for database-side write throttles

Application status is derived from events. Client helpers live in `lib/config/application-state.ts`; canonical event/status config is in `lib/config/events.ts`. Database triggers also protect status consistency for direct Supabase calls.

## Data Flow

Server components fetch user-scoped data through `lib/supabase/server.ts`. RLS scopes reads and writes. Mutations go through Server Actions in `lib/actions/`, then call `revalidatePath()` for affected surfaces.

Supabase clients:

- `lib/supabase/server.ts`: cookie-aware server client
- `lib/supabase/auth.ts`: authenticated user helper

`proxy.ts` is the route gate: unauthenticated users are redirected to `/`; authenticated users are redirected away from `/login`.

## Discover Feed

`lib/feed/source.ts` fetches upstream internship feeds, filters active visible Summer/Fall roles, dedupes postings, and returns normalized `FeedPosting` objects. Postings are not mirrored into Supabase. User-specific state is stored in `feed_interactions`.

Discover hides applied postings by default. A posting is considered applied/tracked when its normalized URL matches an active application posting URL.

## Waitlist

Signup is disabled in `lib/auth/signup-enabled.ts`. The waitlist path lives in `components/waitlist-dialog.tsx` and `lib/actions/waitlist.ts`.

Rules:

- Only `@uw.edu` email addresses are accepted.
- Raw emails are stored in `public.waitlist`.
- Anti-abuse records store HMAC hashes of normalized email and client IP.
- The HMAC secret is generated and stored in `app_private.waitlist_config`, never in app env.
- The app calls `public.join_waitlist`; the private `app_private.join_waitlist` function owns validation, rate limiting, hashing, and table writes.

## UI Conventions

- Default accent is midnight (`lib/config/accent.ts`).
- Tailwind v4 tokens live in `app/globals.css`.
- App shell navigation lives in `components/sidebar.tsx` and `components/app-chrome.tsx`.
- Dashboard rows should stay simple and stable, matching Discover's restrained row behavior.
- Prefer existing UI primitives in `components/ui/`.

## Database Workflow

SQL migrations live in `supabase/migrations/` and are append-only. For durable database changes:

1. Add a new migration file.
2. Apply it with the Supabase connector `_apply_migration` tool or Supabase CLI migration flow.
3. Confirm it appears in `_list_migrations`.
4. Run `select * from app_private.production_integrity_check();`.
5. Review Supabase security and performance advisors.

Do not use the SQL editor as the only place a schema change exists. `_execute_sql` is fine for inspection and operational checks, not durable production DDL.

## More Detail

See `docs/architecture.md` for a fuller walkthrough and `docs/production-runbook.md` for launch/incident checks.
