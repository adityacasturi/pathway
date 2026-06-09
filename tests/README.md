# Tests

Focused unit tests and public Playwright smoke tests. No authenticated e2e or credential env vars.

## Unit (`npm run test:unit`)

Node’s built-in test runner with TypeScript stripping (`tests/run-unit.mjs`). **24 test files**, ~130 assertions covering:

| Area | Files |
| --- | --- |
| Auth | `auth-validation.test.ts`, `auth-redirect.test.ts` |
| Alerts | `alert-filters.test.ts`, `alert-match-postings.test.ts`, `subscription-filters.test.ts`, `alert-unsubscribe-token.test.ts`, `alert-email-template.test.ts` |
| Scrape | `scrape-classify.test.ts`, `scrape-upsert.test.ts`, `scrape-shard.test.ts`, `adapter-parse.test.ts`, `role-parse-result.test.ts`, `ats-postal-address.test.ts` |
| Feed / Discover | `feed-visibility.test.ts`, `feed-interactions.test.ts`, `discover-posting-visibility.test.ts` |
| Applications | `application-state.test.ts`, `application-events.test.ts` |
| Infra | `cron-auth.test.ts`, `rate-limit.test.ts`, `qstash-schedules.test.ts`, `geo-resolve.test.ts`, `url-validation.test.ts`, `build-track-form-data.test.ts` |

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
