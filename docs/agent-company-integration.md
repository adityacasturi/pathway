# Adding a company (manual)

Companies are onboarded by hand: a Supabase migration, optional adapter code, verify, then scrape.

## Standard ATS (Greenhouse / Lever / Ashby)

1. Add `supabase/migrations/NNN_add_<slug>_<type>_source.sql` inserting `companies` and `company_sources` (see existing `049_*`, `050_*`, `062_*` migrations).
2. Apply the migration on your Supabase project (CLI or connector).
3. Verify:

```bash
npm run verify:integration -- <slug>
npm run verify:integration -- <slug> --scrape   # needs SUPABASE_SERVICE_ROLE_KEY
```

4. Scrape postings:

```bash
npm run scrape -- <slug>
```

5. Check `/sources` and `/scout` in the app.

## Custom ATS (Apple, Google, Jane Street, …)

1. Add adapter under `lib/scraping/adapters/<slug>.ts` and register in `lib/scraping/registry.ts`.
2. Add migration + unit tests in `tests/unit/ats-adapters.test.ts` as needed.
3. Run `npm run verify:integration -- <slug>` then `npm run scrape -- <slug>`.

## CI

`.github/workflows/pr-checks.yml` runs static `verify:integration` when a PR adds a new `*_add_<slug>_*_source.sql` migration.

## Branching

Integration work merges into **`dev`** (staging). Promote to **`main`** when ready for production.
