# Tests

## Unit (`npm run test:unit`)

Node’s built-in test runner with TypeScript stripping. Tests live under `tests/unit/**/*.test.ts` and import production code from `lib/` (path aliases via `tests/register-alias.mjs`).

- **Coverage:** `npm run test:unit:coverage` (excludes `lib/scraping/adapters/**` — covered indirectly via shared scrape helpers and audits).
- **Focus:** pure logic (scraping filters, feed IDs, auth validation, application state, stats, discover search, etc.).

## E2E (`npm run test:e2e`)

Playwright against a dev server (or `E2E_BASE_URL`).

| Env | Purpose |
| --- | --- |
| `E2E_USER_EMAIL`, `E2E_USER_PASSWORD` | Authenticated smoke tests (skipped if unset) |
| `E2E_ALLOW_MUTATION=1` | Create/delete application, dismiss/restore posting (single worker) |

## Pre-production gate

```bash
npm run test:preprod       # typecheck + audit + unit + build
npm run test:preprod:full  # lint + preprod + Playwright e2e
npm run verify             # lint + test:preprod
```

Run `test:preprod:full` locally before shipping; CI runs `verify` and public/authenticated e2e on every PR.
