# Architecture

Pathway is a Next.js 16 App Router application backed by Supabase Auth and Postgres. Public signup is enabled for students with `.edu` email addresses.

## Runtime And Framework

- Next.js 16 App Router with Server Components and Server Actions
- React 19
- Tailwind CSS v4 with design tokens in `app/globals.css`
- Supabase Auth, Postgres, RLS, SQL functions, and triggers
- Playwright for e2e coverage
- Node.js 22.x in local and production-like environments

Agents changing Next.js behavior must read the relevant guide in `node_modules/next/dist/docs/` first.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Public landing page and signup entry |
| `/login` | Sign in and account creation |
| `/register` | Stable signup entry that redirects to `/login?mode=signup` |
| `/home` | Authenticated overview of active applications and feed highlights |
| `/applications` | Main application tracker |
| `/discover` | Live internship posting feed |
| `/stats` | Application metrics and funnel visualization |
| `/settings` | Account display and user preferences |
| `/api/logo` | Authenticated company logo proxy to logo.dev (not public) |

`proxy.ts` performs auth gating. Unauthenticated users are sent to `/`; authenticated users are sent away from `/login`.

## Supabase Model

Core public tables:

- `applications`: user-owned application records, archived state, posting URL, season/location, and derived status snapshot
- `application_events`: user-owned timeline events for application progress and OA deadlines
- `feed_interactions`: saved/dismissed Discover posting ids
- `user_preferences`: accent color and quick-track preference
- `rate_limits`: private backing table for database-side write throttles

RLS policies scope user data by `auth.uid()`.

## Application Status

Status is derived from event history rather than manually selected. The app uses `deriveStatus()` from `lib/config/events.ts`; client-side optimistic updates use helpers in `lib/config/application-state.ts`. Database triggers and RPCs protect consistency for direct Supabase calls.

Priority order is rejected, offer, interview, OA, applied.

## Server Actions

Mutations live in `lib/actions/`:

- `auth.ts`: login, signup, OTP verification, and logout
- `applications.ts`: create, update, archive, delete applications
- `events.ts`: create/update/delete events and OA deadline fields
- `feed.ts`: save, unsave, dismiss, restore, and refresh Discover postings
- `settings.ts`: user preferences

Actions validate inputs, use Supabase server clients or narrow RPCs, and revalidate affected paths.

## Discover Feed

`lib/feed/source.ts` fetches upstream GitHub JSON feeds, normalizes rows into `FeedPosting`, filters inactive/invisible postings, keeps Summer/Fall seasons, dedupes equivalent roles, and memoizes work with Next caching. Postings are not copied into the database, and there is no separate scraper or company-board store.

User-specific state is stored separately:

- Saved/dismissed state: `feed_interactions`
- Applied/tracked state: derived from normalized application posting URLs
- Applied postings are hidden by default

## Signup State

`SIGNUPS_ENABLED` is true. Signup UI is available from `/register` and `/login?mode=signup`.

Signup protections:

- Email must normalize to a `.edu` domain
- Raw emails are not logged

## Theme

The default accent is midnight. `app/layout.tsx` sets the default `data-accent`, and authenticated user preference updates persist through `user_preferences`.

## Testing

Public Playwright tests run without credentials. Authenticated tests require:

```bash
E2E_USER_EMAIL="pathway.qa.20260513@uw.edu" \
E2E_USER_PASSWORD="..." \
npm run test:e2e
```

Mutation tests require `E2E_ALLOW_MUTATION=1`. The test config drops to one worker in mutation mode because the suite uses a shared QA account and touches remote Supabase state.

## Migration Discipline

Database history must be formal from here forward:

- Create an append-only file in `supabase/migrations/`.
- Apply it with the Supabase connector `_apply_migration` tool or Supabase CLI.
- Confirm it appears in the Supabase migration list.
- Run the production integrity function and advisors.

Older remote drift exists because some migrations were manually pasted into the SQL editor. Do not rewrite old files to compensate; document drift and keep all future changes formal.
