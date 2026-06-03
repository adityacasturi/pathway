# Discover industries

Discover groups companies under a fixed industry taxonomy. **Supabase is the only source of truth** — labels, descriptions, display order, and company assignments all live in Postgres. The app does not keep a parallel slug map in TypeScript.

## Tables

| Table | Role |
| --- | --- |
| `discover_industries` | Canonical list: `slug`, `label`, `description`, `sort_order` |
| `companies.industry` | FK → `discover_industries.slug` (default `enterprise-software`) |

Authenticated users can `SELECT` from `discover_industries` (RLS). Writes go through migrations / service role.

**Migrations (remote):** `discover_industries_catalog`, `discover_industries_company_backfill`, `drop_companies_industry_check`, `harden_discover_industries_grants`. Git copies: `supabase/migrations/177_*`, `178_*`.

## App code

| Module | Role |
| --- | --- |
| `lib/discover/catalog.ts` | `loadDiscoverIndustryCatalog()` — reads `discover_industries` |
| `lib/discover/companies.ts` | Loads companies; joins labels from catalog |
| `lib/discover/industries.ts` | `groupCompaniesByIndustry()` — ordering uses catalog `sort_order` |
| `components/discover-companies.tsx` | Industry filter chips and section headings |

## Industry slugs (34)

Use these exact `slug` values when seeding `companies.industry`.

| Slug | Label |
| --- | --- |
| `platform` | Big tech |
| `semiconductor` | Semiconductors |
| `networking` | Networking |
| `ai-research` | AI research |
| `ai-products` | AI products |
| `ai-infrastructure` | AI infrastructure |
| `life-sciences` | Life sciences |
| `payments` | Payments |
| `fintech` | Fintech |
| `banking` | Banking & markets |
| `crypto` | Crypto |
| `cloud` | Cloud & hosting |
| `data` | Data platforms |
| `devtools` | Developer tools |
| `cybersecurity` | Cybersecurity |
| `defense` | Defense |
| `space` | Space |
| `aviation` | Aviation |
| `automotive` | Automotive |
| `autonomous-vehicles` | Autonomous vehicles |
| `robotics` | Robotics |
| `drones` | Drones |
| `quant` | Quant trading |
| `gaming` | Gaming |
| `streaming` | Streaming |
| `social` | Social |
| `marketplaces` | Marketplaces |
| `on-demand` | On-demand |
| `ecommerce` | E-commerce |
| `enterprise-software` | Enterprise software |
| `productivity` | Productivity |
| `hr-tech` | HR & payroll |
| `healthtech` | Healthtech |
| `consumer-tech` | Consumer tech |

Descriptions and `sort_order` are in `discover_industries` (query the table or read migration `177_discover_industries_catalog.sql`).

### Design notes

- **Split AI** into research labs, products, and infrastructure (not one “AI” bucket).
- **Split mobility** into `automotive`, `autonomous-vehicles`, `robotics`, `drones`, `aviation`, `space`, and `defense` (no broad “autonomy” or “aerospace” labels).
- **Split finance** into `payments`, `fintech`, `banking`, `crypto`, and `quant`.
- **Split consumer** into `social`, `marketplaces`, `on-demand`, `ecommerce`, and `consumer-tech`.
- **Defense vs cybersecurity:** primes and mil-tech → `defense`; security software → `cybersecurity`.

## Onboarding a company

When inserting into `companies`, set `industry` to the best-matching slug from the table above.

```sql
insert into public.companies (slug, name, website_url, careers_url, industry)
values (
  'example-co',
  'Example Co',
  'https://example.com',
  'https://example.com/careers',
  'devtools'
)
on conflict (slug) do update set
  name = excluded.name,
  website_url = coalesce(public.companies.website_url, excluded.website_url),
  careers_url = coalesce(public.companies.careers_url, excluded.careers_url),
  industry = coalesce(public.companies.industry, excluded.industry),
  updated_at = now();
```

If unsure, use `enterprise-software` (column default). Invalid slugs fail the FK constraint.

See [scraping.md](./scraping.md) for the full Discover onboarding flow and [.cursor/skills/discover-queue/SKILL.md](../.cursor/skills/discover-queue/SKILL.md) for queue workers.

## Adding or changing industries

1. **New industry slug** — `apply_migration` that `INSERT`s into `discover_industries` (slug, label, description, sort_order). Pick `sort_order` to control section order on Discover.
2. **Reclassify companies** — `UPDATE public.companies SET industry = '<slug>' WHERE slug IN (...)` in the same or a follow-up migration.
3. **Large backfills** — edit `COMPANY_INDUSTRY` in `scripts/generate-discover-industry-migration.mjs`, run `node scripts/generate-discover-industry-migration.mjs`, review generated SQL, then `apply_migration` (do not commit generated bulk SQL without review).

Do not reintroduce app-side slug maps (`COMPANY_INDUSTRY_BY_SLUG`); the UI reads the database.

## Inspection

```sql
select slug, label, sort_order from public.discover_industries order by sort_order;

select industry, count(*) as companies
from public.companies
where is_active
group by industry
order by companies desc;

select c.slug, c.industry, d.label
from public.companies c
join public.discover_industries d on d.slug = c.industry
where c.slug = 'stripe';
```
