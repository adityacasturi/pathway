# Home Briefing Redesign

**Date:** 2026-05-31  
**Status:** Approved

## Goal

Transform Home from three stacked feed lists into a morning briefing: personal urgency first, compact market context second, while keeping new internships, OA deadlines, and saved apps.

## Page structure (top → bottom)

1. **Header** — title, refresh, market pulse one-liner
2. **Deadlines** — up to 5 OA countdowns (unchanged UI, moved up)
3. **Pipeline strip** — read-only links to `/applications?status=*`
4. **At your companies** — up to 3 rows from followed/applied companies (7-day window)
5. **Since yesterday** — up to 5 new postings (24h window)
6. **Market activity** — hot companies + industry spotlight (2-column, 7-day window)
7. **For later** — up to 8 saved postings

## Data

- **Server aggregations:** `lib/home/briefing.ts` (unit tested)
- **Industry map:** `lib/home/company-industry-map.ts`
- **Favorite slugs:** extend `lib/discover/favorites.ts`
- **No DB migration** — reads existing tables only

## Out of scope (v1)

- Configurable sections
- Stale-application nudges
- Charts / stats visuals
- Scrape on refresh

## Verification

- `tests/unit/home-briefing.test.ts`
- `npm run verify`
