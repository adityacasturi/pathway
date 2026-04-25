# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server on localhost:3000
npm run build    # production build
npm run lint     # run ESLint
```

No test suite is configured.

## Next.js version note

This project uses **Next.js 16** — APIs and conventions may differ from training data. Read `node_modules/next/dist/docs/` before writing code that touches routing, middleware, or server components.

## Architecture

**Launchpad** is an internship application tracker. Users log in via Supabase Auth and track applications through a lifecycle of events (applied → OA → interview → offer/rejected).

### Data model

Three Supabase tables:
- `applications` — `id, user_id, company, role, posting_url, status, created_at`
- `application_events` — `id, application_id, user_id, event_type, event_date, notes, round_number, created_at`
- `feed_interactions` — `(user_id, posting_id, kind, created_at)` — per-user discover-feed interactions. The current app flow uses `kind = 'dismissed'`. The postings themselves are **not** stored locally.

**Status is always derived from events, never set manually.** `deriveStatus()` in `lib/config/events.ts` computes status by highest-priority event type (rejected > offer > interview > oa > applied). All mutations that add/remove events re-derive and persist the status.

### Data flow

`app/page.tsx` is a server component that fetches `applications` with nested `application_events`, runs `normalizeApplicationState()` on each row (sorts events, derives status, computes `last_activity_date`), then passes the result to `<Dashboard>`.

All mutations go through **Next.js Server Actions** in `lib/actions/` — `applications.ts`, `events.ts`, `auth.ts`, and `feed.ts`. Actions call `revalidatePath("/")` or `revalidatePath("/discover")` to trigger a server re-fetch, which flows back to the client as fresh props.

### Optimistic updates

`ApplicationDetail` (the modal card) manages a local `optimisticApplication` state. On any mutation it immediately applies the change locally using helpers from `lib/config/application-state.ts` (`addEvent`, `removeEvent`, `applyEventPatch`, `replaceEvent`), then fires the server action. On error it rolls back to the previous state. New events get a temporary `temp-…` id that is swapped out for the server-issued id once the action returns.

### Supabase clients

- `lib/supabase/server.ts` — for server components and server actions (cookie-based session)
- `lib/supabase/auth.ts` — convenience wrapper returning `{ supabase, user }` for server use

`proxy.ts` (the Next.js 16 replacement for `middleware.ts`) guards all routes: unauthenticated users are redirected to `/login`; authenticated users are redirected away from `/login`.

### UI

- Component library: shadcn/ui style components in `components/ui/`, built on top of `@base-ui/react` primitives, with Tailwind CSS v4
- Theme: `next-themes` with `ThemeProvider` in `app/providers.tsx`; `suppressHydrationWarning` is required on `<html>`
- Font: JetBrains Mono via `next/font/google`
- Company logos: `lib/logo.ts` + `components/company-logo.tsx` using the [logo.dev](https://logo.dev) API; falls back to a deterministic colored initial when no API token is set or the image fails to load
- Animations: `framer-motion` with shared variants in `lib/ui/motion.ts`

### Reusable building blocks

- `components/ui/inline-edit.tsx` — text input that looks like plain text and commits on blur/Enter
- `components/ui/async-button.tsx` — button that swaps its label/affordance based on `idle | pending | success | error` state
- `components/ui/inline-error.tsx` — error pill with optional retry button
- `components/ui/loading-indicator.tsx` — `InlineSpinner`, `SkeletonBlock`
- `components/status-badge.tsx` — `StatusBadge`, `StatusDot`, `EventDot` (single source of truth for status/event chips)
- `lib/url.ts` — `normalizeUrl()` (auto-prepends `https://`) and `displayUrl()` (host-only label)

### Discover feed (`/discover`)

Live internship feed sourced from the upstream `listings.json`:

- `lib/feed/source.ts` — `FEED_SOURCES` (upstream raw URLs), `FeedPosting` type, and `fetchFeed()` which pulls all sources in parallel, filters to `active && is_visible && season in (Summer, Fall)`, and returns newest-first. Uses Next ISR (`revalidate: 3600`); nothing is mirrored into Supabase.
- `lib/actions/feed.ts` — `dismissPosting`, `undismissPosting`, `refreshFeed`. Dismiss state persists to `feed_interactions`; refresh invalidates the feed caches.
- `app/discover/page.tsx` — RSC that fetches the feed, the user's interactions, and the set of `posting_url`s from the user's applications.
- `components/discover-feed.tsx` — client renderer. **"Tracked" status is derived**, not stored: a posting is tracked when its url (normalized via `lib/url.ts`) matches any of the user's `applications.posting_url`. The current UI only persists dismissed postings in `feed_interactions`.
- NEW badge comes from comparing each posting's `date_posted` against `localStorage.launchpad:feed-last-seen-at`, which is stamped on unmount.

To add a new upstream source, append to `FEED_SOURCES` — no schema change needed.

### Keyboard shortcuts (dashboard)

- `/` focuses the search input
- `n` opens the Add Application dialog
- Both shortcuts are skipped while typing in inputs/textareas/contentEditable, and while a modal is open.

### Config / reference data

- `lib/config/events.ts` — `EVENT_CONFIG`, `STATUSES`, `STATUS_LABELS`, `ADDABLE_EVENT_TYPES`, `deriveStatus()`, `eventLabel()`
- `lib/config/application-state.ts` — pure functions for normalizing/patching an `Application` object client-side
- `types/application.ts` — `Application`, `ApplicationEvent`, `Status`, `EventType`

### Database migrations

SQL migrations live in `supabase/migrations/` and are append-only. Apply by pasting into the Supabase SQL editor in numerical order.
