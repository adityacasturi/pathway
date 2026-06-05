# HeroUI + Magic UI App Interior Design

**Date:** 2026-06-05  
**Status:** Approved  
**Approach:** Foundation first (A), full authenticated app interior

---

## Goal

Adopt HeroUI for interactive primitives and Magic UI for motion/polish across all authenticated app routes, while keeping landing and auth flows unchanged.

## Scope

### In scope

| Route | Component entry |
| --- | --- |
| `/home` | `components/home.tsx` |
| `/applications` | `components/dashboard.tsx`, `components/applications-table.tsx` |
| `/openings` | `components/live-feed.tsx` |
| `/companies` | `components/discover-companies.tsx` |
| `/alerts` | `components/alerts-page.tsx`, `components/alert-filters-editor.tsx`, `components/alert-subscription-filter-dialog.tsx` |
| `/insights` | `components/stats-page.tsx`, `components/stats/*` |
| `/settings` | `components/settings-page.tsx` |

Shared shell pieces used by all routes: `components/sidebar.tsx`, `components/route-skeletons.tsx`, `components/search-input.tsx`, `components/ui/*`.

### Out of scope

- Landing (`app/page.tsx`, `components/landing/*`)
- Auth (`app/login`, `app/register`, `app/set-password`, `components/auth/*`)
- Replacing TanStack Table with HeroUI `Table`
- Replacing Sonner with HeroUI `Toast`
- Replacing Recharts with HeroUI chart components
- Flashy Magic UI effects (particles, marquees, text-reveal) in app interior

---

## Architecture

### Layer split

| Layer | Library | Responsibility |
| --- | --- | --- |
| Interaction | HeroUI via `components/ui/*` wrappers | Switches, chips, tabs, selects, popovers, dropdowns, skeletons, disclosures, radio groups |
| Polish | Magic UI via `components/magicui/*` | Section entrances, metric emphasis, empty states, subtle card effects, list stagger |
| Layout | Existing `components/ui/page.tsx` | Page shell unchanged |
| Motion tokens | `lib/ui/motion.ts` | Shared easing/duration; coexists with Magic UI |

### Foundation changes

1. **`components.json`**
   - Add `"magicui": "@/components/magicui"` alias
   - Register Magic UI shadcn registry (`@magicui/*`)

2. **Folder convention**
   - Rename `components/magic-ui/` → `components/magicui/` (CLI standard)
   - Update all imports

3. **Motion consolidation**
   - Standardize on `framer-motion` for app code
   - Remove lone `motion/react` import from empty-state when migrated

4. **HeroUI wrappers** (new or migrated in `components/ui/`)
   - `switch.tsx` — HeroUI `Switch` (replaces custom button switch)
   - `chip.tsx` — HeroUI `Chip` (replaces `filter-chip.tsx` internals)
   - `tabs.tsx` — HeroUI `Tabs` (replaces `SegmentedControl` in filter-menu)
   - `skeleton.tsx` — HeroUI `Skeleton` (replaces `SkeletonBlock`)
   - `popover.tsx` — HeroUI `Popover`
   - `dropdown.tsx` — HeroUI `Dropdown` + `Menu`
   - `select.tsx` — HeroUI `Select` / `Autocomplete`
   - `disclosure.tsx` — HeroUI `Disclosure`
   - `radio-group.tsx` — HeroUI `RadioGroup` (settings accent picker)

5. **Magic UI components to install**
   - `blur-fade` — section entrances
   - `number-ticker` — metric/snapshot counts
   - `magic-card` — metric and company cards
   - `dot-pattern` — empty state backgrounds
   - `animated-list` — feed/table row stagger

6. **Backward-compatible re-exports**
   - `filter-chip.tsx` re-exports from `chip.tsx` until call sites migrated
   - `loading-indicator.tsx` re-exports from `skeleton.tsx`
   - `SegmentedControl` in `filter-menu.tsx` delegates to `tabs.tsx`

---

## Screen-by-screen design

### `/home` (Overview)

- Wrap briefing sections in `BlurFade`
- `MagicCard` on `PipelineSummaryCell` in `components/home/home-snapshot.tsx`
- `NumberTicker` on snapshot counts
- Remove redundant `framer-motion` section wrappers where `BlurFade` covers the same effect

### `/applications`

- `AnimatedList` for table rows in `applications-table.tsx`
- HeroUI `Dropdown` for row action menu (replaces positioned context menu)
- `EmptyState` with `DotPattern` when empty/filtered
- Dashboard filters via shared HeroUI `Tabs` + `Chip` migration in `dashboard.tsx`

### `/openings`

- Shared filter migration (`Tabs`, `Chip`, HeroUI `Switch` toggles)
- `AnimatedList` on posting rows in `live-feed.tsx`
- Polished `EmptyState` when feed is empty

### `/companies`

- `FilterChip` → HeroUI `Chip` for industry filters
- `SegmentedControl` → HeroUI `Tabs` for season filter
- `Disclosure` for collapsed industry filter list
- `MagicCard` on company cards in discover grid
- `AnimatedList` for company rows and expanded posting lists
- HeroUI `Skeleton` for posting load states (replaces `SkeletonBlock`)
- `EmptyState` + `DotPattern` when search/filter yields nothing

### `/alerts`

- Custom `Switch` → HeroUI wrapper (email/digest toggles)
- `FilterChip` → HeroUI `Chip` (seasons)
- `Disclosure` for global vs per-subscription filter blocks
- `Select`/`Autocomplete` for add-company search
- `MagicCard` on subscription rows (subtle hover emphasis)
- `BlurFade` on page sections

### `/insights`

- `NumberTicker` on `MetricCard` values in `stats-page.tsx`
- `MagicCard` on metric grid cards
- `BlurFade` between sections (pipeline, market, hot companies)
- `EmptyState` when no applications

### `/settings`

- HeroUI `Switch` for quick-track toggle
- HeroUI `RadioGroup` for accent color (replaces custom `role="radiogroup"` buttons)
- `BlurFade` on account and preferences sections
- `MagicCard` wrapper on account block (avatar + email)

### Shared shell

- `route-skeletons.tsx` — HeroUI `Skeleton` instead of `SkeletonBlock`
- `sidebar.tsx` — already uses HeroUI `Tooltip`; add `BlurFade` optional on nav label transitions only if it does not conflict with existing motion

---

## Migration order

```
Phase 0  Foundation (components.json, magicui folder, CLI installs, HeroUI wrappers)
Phase 1  Shared primitives (switch, chip, tabs, skeleton, popover, dropdown, disclosure, radio-group)
Phase 2  Route migrations (lowest risk → highest complexity):
         Insights → Settings → Home → Openings → Applications → Companies → Alerts
Phase 3  Cleanup (remove dead code, unify imports, update docs)
```

Each phase is independently shippable.

---

## Guardrails

- **Subtle over flashy** in app interior — no particles or marquees
- **Wrapper APIs first** — migrate internals before renaming imports at call sites
- **Accessibility** — prefer HeroUI over custom ARIA button patterns
- **Design tokens** — all wrappers must respect `globals.css` CSS variables (`--primary`, `--rule`, etc.)
- **Tests** — `npm run test:preprod` must pass after each phase; no new tests unless wrapper behavior is non-trivial

---

## Documentation updates

After Phase 0, update `docs/architecture.md` UI stack row to reflect Magic UI registry + expanded HeroUI wrappers.

---

## Success criteria

1. All seven in-scope routes use at least one Magic UI polish component
2. Custom `Switch`, `FilterChip`, `SegmentedControl`, and `SkeletonBlock` are HeroUI-backed or removed
3. `components/magic-ui/` folder no longer exists (renamed to `magicui`)
4. No `motion/react` imports in app interior
5. `npm run verify` passes
