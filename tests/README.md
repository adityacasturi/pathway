# Tests

Focused unit tests and public Playwright smoke tests. No authenticated e2e or credential env vars.

## Unit (`npm run test:unit`)

Node’s built-in test runner with TypeScript stripping (`tests/run-unit.mjs`). Covers auth, alerts, scrape, feed, discover, applications, geo, and rate limiting.

No env vars required. Optional coverage: `npm run test:unit:coverage`.

Adapter HTML/JSON fixture regressions: `npm run scrape:audit-adapters` and local `npm run scrape` — not duplicated in unit tests.

## E2E (`npm run test:e2e`)

Playwright smoke tests in `tests/e2e/public.spec.ts`:

1. Landing page for anonymous users
2. Login and register are public
3. Protected routes redirect to `/login?next=…`
4. Static company logos + logo proxy auth gate
5. Security headers on `/login`

**No login credentials required.**

Starts the production build on port 3100 (`npm run build` first, or use `npm run test:preprod:full`). Set `E2E_BASE_URL` to hit an existing server instead.

## CI gate

```bash
npm run verify             # lint + typecheck + audit + unit + build
npm run test:preprod:full  # verify + Playwright e2e
```

Run `npm run test:preprod:full` locally before production deploys.
