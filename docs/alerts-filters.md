# Alert filters

Email alerts match **follows** (company or industry bundle) plus **filters** (what roles count).

## Global defaults

Stored on `alert_preferences`:

| Column | Meaning |
| --- | --- |
| `alert_seasons` | `text[]` subset of Summer, Fall, Spring, Winter; `null` or `{}` = all seasons |
| `alert_countries` | ISO 3166-1 alpha-2 codes; `null` or `{}` = all countries |
| `alert_include_remote` | When `false`, exclude remote-only postings unless a selected country also matches |

Set via `/alerts` → **Defaults** (filter editor). The server action validates the serialized filter payload and writes the scoped `alert_preferences` row with the service-role client for the authenticated `user.id`.

## Per-follow overrides

`alert_subscriptions.filter_override` is optional JSON:

```json
{ "seasons": ["Fall"], "countries": ["US"], "include_remote": true }
```

Partial keys merge over global defaults in `mergeAlertFilters`. `null` override = inherit globals.

## Matching semantics

Implemented in `postingMatchesAlertFilters` (`lib/alerts/filters.ts`):

- **Season:** posting `season` must be in the selected set (if any). New scraped postings default to `Summer` when no season is stated; legacy null seasons match any season filter so missing historical data is not hidden.
- **Country:** location string parsed with `countriesFromLocationField`; any detected country in the selected set matches (same OR semantics as Openings for multi-city strings).
- **Remote:** if `include_remote` is false and the location reads as remote, the posting is dropped unless a country filter is active and at least one selected country matches.

Postings without a location string are never alert-eligible (`isAlertEligiblePosting`).

## Write path

Alert writes flow through `lib/actions/alerts.ts` server actions. App code must not write alert tables from the browser or from an authenticated Supabase client. Server actions authenticate the user, validate filter payloads, and perform scoped service-role writes for that `user.id`.

Hosted hardening (2026-06): legacy public alert write RPCs dropped; client table writes revoked; read-only RLS policies on `alert_preferences` / `alert_subscriptions` for direct client access.

## Tests

Covered by `alert-filters.test.ts`, `alert-match-postings.test.ts`, and `subscription-filters.test.ts` under `tests/unit/` (`npm run test:unit`).
