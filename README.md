# Launchpad

A minimal internship application tracker. Log in, add applications, and track each one through its lifecycle of events (applied → OA → interview → offer / rejected). Status is always derived from the events on each application.

Built with Next.js 16 (App Router + Server Actions), Supabase (Auth + Postgres with RLS), Tailwind CSS v4, and shadcn-style components on top of `@base-ui/react`.

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a Supabase project and copy the credentials into a `.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   # Optional: enables cached company logos via https://logo.dev
   LOGO_DEV_TOKEN=...
   ```
3. Apply the SQL migrations in `supabase/migrations/` in order via the Supabase SQL editor.
4. Run the dev server:
   ```bash
   npm run dev
   ```
   Visit [http://localhost:3000](http://localhost:3000).

## Scripts

| Command         | What it does                       |
| --------------- | ---------------------------------- |
| `npm run dev`   | Start the dev server               |
| `npm run build` | Production build                   |
| `npm run lint`  | Run ESLint                         |

## Project layout

```
app/                Next.js App Router routes (server components + auth pages)
components/         UI components — dashboard, detail modal, table, badges
components/ui/      Reusable primitives (buttons, inputs, dialogs, etc.)
lib/actions/        Next.js server actions (mutations)
lib/config/         Pure config + state helpers (events, status derivation)
lib/supabase/       Supabase client factories (server / browser)
lib/ui/             Shared UI utilities (motion variants)
proxy.ts            Auth gate — redirects to /login when no session
supabase/migrations Append-only SQL migrations
types/              TypeScript types (`Application`, `ApplicationEvent`, …)
```

See [`CLAUDE.md`](./CLAUDE.md) for a deeper architectural walkthrough.
