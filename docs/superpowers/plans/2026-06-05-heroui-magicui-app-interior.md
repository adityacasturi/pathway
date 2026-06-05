# HeroUI + Magic UI App Interior Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt HeroUI interactive primitives and Magic UI polish across all seven authenticated app routes (`/home` through `/settings`), foundation-first.

**Architecture:** Expand `components/ui/*` as HeroUI wrappers; install Magic UI via shadcn CLI into `components/magicui/`; migrate routes one at a time from Insights (simplest) through Alerts (most complex). TanStack Table, Sonner, Recharts, and `PageShell` stay unchanged.

**Tech Stack:** Next.js 16, React 19, `@heroui/react` 3.1, shadcn CLI + Magic UI registry, `framer-motion` 12.

**Spec:** [docs/superpowers/specs/2026-06-05-heroui-magicui-app-interior-design.md](../specs/2026-06-05-heroui-magicui-app-interior-design.md)

---

## File map

| File | Responsibility |
| --- | --- |
| `components.json` | Add `magicui` alias + Magic UI registry |
| `components/magicui/*` | Magic UI installed components |
| `components/ui/switch.tsx` | HeroUI Switch wrapper |
| `components/ui/chip.tsx` | HeroUI Chip wrapper |
| `components/ui/tabs.tsx` | HeroUI Tabs wrapper (segmented control) |
| `components/ui/skeleton.tsx` | HeroUI Skeleton wrapper |
| `components/ui/popover.tsx` | HeroUI Popover wrapper |
| `components/ui/dropdown.tsx` | HeroUI Dropdown + Menu wrapper |
| `components/ui/select.tsx` | HeroUI Select/Autocomplete wrapper |
| `components/ui/disclosure.tsx` | HeroUI Disclosure wrapper |
| `components/ui/radio-group.tsx` | HeroUI RadioGroup wrapper |
| `components/ui/filter-chip.tsx` | Re-export from `chip.tsx` |
| `components/ui/loading-indicator.tsx` | Re-export from `skeleton.tsx` |
| `components/ui/filter-menu.tsx` | Delegate SegmentedControl to tabs |
| `components/magicui/empty-state.tsx` | Upgraded empty state (moved from magic-ui) |
| `components/stats-page.tsx` | Insights Magic UI |
| `components/settings-page.tsx` | Settings HeroUI + Magic UI |
| `components/home.tsx`, `components/home/home-snapshot.tsx` | Home Magic UI |
| `components/live-feed.tsx` | Openings migration |
| `components/dashboard.tsx`, `components/applications-table.tsx` | Applications migration |
| `components/discover-companies.tsx` | Companies migration |
| `components/alerts-page.tsx`, `components/alert-filters-editor.tsx` | Alerts migration |
| `components/route-skeletons.tsx` | Shared skeleton migration |
| `docs/architecture.md` | Stack documentation |

---

## Phase 0: Foundation

### Task 1: Wire Magic UI registry

**Files:**
- Modify: `components.json`

- [ ] **Step 1: Add magicui alias and registry**

```json
{
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks",
    "magicui": "@/components/magicui"
  },
  "registries": {
    "@magicui": "https://magicui.design/r/{name}.json"
  }
}
```

- [ ] **Step 2: Verify shadcn can resolve registry**

Run: `npx shadcn@latest add @magicui/blur-fade --dry-run`  
Expected: resolves component without error (dry-run may not exist; if so, skip to Step 3)

- [ ] **Step 3: Commit**

```bash
git add components.json
git commit -m "chore: add Magic UI registry and magicui alias"
```

---

### Task 2: Install Magic UI components

**Files:**
- Create: `components/magicui/blur-fade.tsx`
- Create: `components/magicui/number-ticker.tsx`
- Create: `components/magicui/magic-card.tsx`
- Create: `components/magicui/dot-pattern.tsx`
- Create: `components/magicui/animated-list.tsx`

- [ ] **Step 1: Install via CLI**

```bash
npx shadcn@latest add @magicui/blur-fade @magicui/number-ticker @magicui/magic-card @magicui/dot-pattern @magicui/animated-list --yes
```

- [ ] **Step 2: Fix any import path issues**

Ensure installed files live under `components/magicui/` and use `@/lib/utils` for `cn`.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`  
Expected: PASS (fix any Motion import mismatches to use `framer-motion`)

- [ ] **Step 4: Commit**

```bash
git add components/magicui package.json package-lock.json
git commit -m "feat: install core Magic UI components for app interior"
```

---

### Task 3: Rename magic-ui folder

**Files:**
- Move: `components/magic-ui/empty-state.tsx` → `components/magicui/empty-state.tsx`
- Modify: imports in `live-feed.tsx`, `applications-table.tsx`, `stats-page.tsx`, `discover-companies.tsx`

- [ ] **Step 1: Move file and update imports**

```bash
git mv components/magic-ui/empty-state.tsx components/magicui/empty-state.tsx
```

Update imports from `@/components/magic-ui/empty-state` to `@/components/magicui/empty-state`.

- [ ] **Step 2: Change motion import in empty-state**

In `components/magicui/empty-state.tsx`, replace:

```tsx
import { motion } from "motion/react";
```

with:

```tsx
import { motion } from "framer-motion";
```

- [ ] **Step 3: Remove empty magic-ui directory**

```bash
rmdir components/magic-ui 2>/dev/null || true
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move empty-state to components/magicui"
```

---

### Task 4: HeroUI Switch wrapper

**Files:**
- Modify: `components/ui/switch.tsx`

- [ ] **Step 1: Replace custom switch with HeroUI**

```tsx
"use client";

import { Switch as HeroSwitch } from "@heroui/react";
import { cn } from "@/lib/utils";

export function Switch({
  checked,
  disabled,
  onCheckedChange,
  className,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  "aria-label": string;
}) {
  return (
    <HeroSwitch
      isSelected={checked}
      isDisabled={disabled}
      onChange={onCheckedChange}
      aria-label={ariaLabel}
      className={cn(className)}
    />
  );
}
```

- [ ] **Step 2: Verify alerts and settings still render**

Run: `npm run typecheck`  
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add components/ui/switch.tsx
git commit -m "feat: HeroUI-backed Switch wrapper"
```

---

### Task 5: HeroUI Chip wrapper

**Files:**
- Create: `components/ui/chip.tsx`
- Modify: `components/ui/filter-chip.tsx`

- [ ] **Step 1: Create chip wrapper**

```tsx
"use client";

import type { ReactNode } from "react";
import { Chip as HeroChip } from "@heroui/react";
import { cn } from "@/lib/utils";

export function Chip({
  label,
  active,
  onClick,
  className,
  count,
  prefix,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  count?: number;
  prefix?: ReactNode;
}) {
  return (
    <HeroChip
      variant={active ? "solid" : "bordered"}
      color={active ? "accent" : "default"}
      className={cn("cursor-pointer", className)}
      onClick={onClick}
    >
      {prefix}
      {label}
      {count !== undefined ? ` (${count})` : null}
    </HeroChip>
  );
}
```

- [ ] **Step 2: Make filter-chip re-export**

Replace `components/ui/filter-chip.tsx` body with:

```tsx
export { Chip as FilterChip } from "@/components/ui/chip";
```

Preserve any extra props the old FilterChip had by extending `Chip` if call sites pass `tone` or `prefix` — read current `filter-chip.tsx` and map props before deleting logic.

- [ ] **Step 3: Commit**

```bash
git add components/ui/chip.tsx components/ui/filter-chip.tsx
git commit -m "feat: HeroUI-backed Chip wrapper"
```

---

### Task 6: HeroUI Tabs wrapper (segmented control)

**Files:**
- Create: `components/ui/tabs.tsx`
- Modify: `components/ui/filter-menu.tsx`

- [ ] **Step 1: Create tabs wrapper with segmented API**

```tsx
"use client";

import { Tabs } from "@heroui/react";
import { cn } from "@/lib/utils";

export function SegmentedTabs<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
  className?: string;
}) {
  return (
    <Tabs
      selectedKey={value}
      onSelectionChange={(key) => onChange(String(key) as T)}
      className={cn("w-full", className)}
    >
      <Tabs.List className="w-full">
        {options.map((option) => (
          <Tabs.Tab key={option.value} id={option.value} className="flex-1">
            {option.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs>
  );
}
```

Adjust to match actual HeroUI 3.1 Tabs API — read `node_modules/@heroui/react/dist/components/tabs/index.d.ts` before implementing.

- [ ] **Step 2: Update filter-menu SegmentedControl to delegate**

```tsx
import { SegmentedTabs } from "@/components/ui/tabs";

export function SegmentedControl<T extends string>(props: ...) {
  return <SegmentedTabs {...props} />;
}
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/tabs.tsx components/ui/filter-menu.tsx
git commit -m "feat: HeroUI-backed segmented tabs"
```

---

### Task 7: HeroUI Skeleton wrapper

**Files:**
- Create: `components/ui/skeleton.tsx`
- Modify: `components/ui/loading-indicator.tsx`

- [ ] **Step 1: Create skeleton wrapper**

```tsx
import { Skeleton } from "@heroui/react";
import { cn } from "@/lib/utils";

export function SkeletonBlock({ className }: { className?: string }) {
  return <Skeleton className={cn("rounded-md", className)} />;
}
```

- [ ] **Step 2: Re-export from loading-indicator**

```tsx
export { SkeletonBlock } from "@/components/ui/skeleton";
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/skeleton.tsx components/ui/loading-indicator.tsx
git commit -m "feat: HeroUI-backed Skeleton wrapper"
```

---

### Task 8: Remaining HeroUI wrappers

**Files:**
- Create: `components/ui/popover.tsx`
- Create: `components/ui/dropdown.tsx`
- Create: `components/ui/select.tsx`
- Create: `components/ui/disclosure.tsx`
- Create: `components/ui/radio-group.tsx`

- [ ] **Step 1: Implement each wrapper**

Read HeroUI 3.1 component APIs from `node_modules/@heroui/react/dist/components/*/index.d.ts`. Each wrapper exports a thin component matching patterns in `button.tsx` and `dialog.tsx` (className via `cn`, tokens from globals).

`radio-group.tsx` must support:

```tsx
<RadioGroup value={selected} onChange={setSelected} options={[{ value, label, swatch? }]} />
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`  
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add components/ui/popover.tsx components/ui/dropdown.tsx components/ui/select.tsx components/ui/disclosure.tsx components/ui/radio-group.tsx
git commit -m "feat: add HeroUI popover, dropdown, select, disclosure, radio-group wrappers"
```

---

### Task 9: Update architecture docs

**Files:**
- Modify: `docs/architecture.md`

- [ ] **Step 1: Update UI stack row**

Document Magic UI registry, `components/magicui/`, and expanded HeroUI wrapper list.

- [ ] **Step 2: Commit**

```bash
git add docs/architecture.md
git commit -m "docs: update UI stack for HeroUI and Magic UI adoption"
```

---

## Phase 1: Route migrations

### Task 10: Insights (`/insights`)

**Files:**
- Modify: `components/stats-page.tsx`
- Modify: `components/magicui/empty-state.tsx` (optional DotPattern integration)

- [ ] **Step 1: Wrap sections in BlurFade**

```tsx
import { BlurFade } from "@/components/magicui/blur-fade";

<BlurFade delay={0.05}>
  <PageSection>...</PageSection>
</BlurFade>
```

Apply to pipeline, market, and hot-companies sections.

- [ ] **Step 2: Upgrade MetricCard**

```tsx
import { MagicCard } from "@/components/magicui/magic-card";
import { NumberTicker } from "@/components/magicui/number-ticker";

// Wrap card content in MagicCard; parse numeric value for NumberTicker where applicable
```

- [ ] **Step 3: Run verify**

Run: `npm run verify`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/stats-page.tsx
git commit -m "feat: Magic UI polish on Insights page"
```

---

### Task 11: Settings (`/settings`)

**Files:**
- Modify: `components/settings-page.tsx`

- [ ] **Step 1: Replace accent radiogroup with RadioGroup wrapper**

Remove custom `role="radiogroup"` buttons; use `components/ui/radio-group.tsx` with swatch rendering per `ACCENT_OPTIONS`.

- [ ] **Step 2: Add BlurFade + MagicCard on account section**

Wrap account block in `MagicCard`; wrap page sections in `BlurFade`.

- [ ] **Step 3: Quick track Switch already uses wrapper from Task 4 — verify styling**

- [ ] **Step 4: Commit**

```bash
git add components/settings-page.tsx
git commit -m "feat: HeroUI radio group and Magic UI on Settings"
```

---

### Task 12: Home (`/home`)

**Files:**
- Modify: `components/home.tsx`
- Modify: `components/home/home-snapshot.tsx`

- [ ] **Step 1: BlurFade on briefing sections**

Replace or complement `motion.div` wrappers with `BlurFade` for snapshot, since-yesterday, saved sections.

- [ ] **Step 2: MagicCard + NumberTicker on PipelineSummaryCell**

In `home-snapshot.tsx` or `application-pipeline-summary.tsx`, wrap cells in `MagicCard` and animate counts with `NumberTicker`.

- [ ] **Step 3: Commit**

```bash
git add components/home.tsx components/home/home-snapshot.tsx
git commit -m "feat: Magic UI polish on Home briefing"
```

---

### Task 13: Openings (`/openings`)

**Files:**
- Modify: `components/live-feed.tsx`

- [ ] **Step 1: AnimatedList for posting rows**

```tsx
import { AnimatedList } from "@/components/magicui/animated-list";

<AnimatedList>
  {postings.map((posting) => (
    <AnimatedList.Item key={posting.id}>...</AnimatedList.Item>
  ))}
</AnimatedList>
```

Adjust to actual AnimatedList API from installed component.

- [ ] **Step 2: Remove redundant row-level framer-motion if AnimatedList covers it**

- [ ] **Step 3: Upgrade EmptyState with DotPattern**

- [ ] **Step 4: Commit**

```bash
git add components/live-feed.tsx components/magicui/empty-state.tsx
git commit -m "feat: Magic UI list and empty state on Openings"
```

---

### Task 14: Applications (`/applications`)

**Files:**
- Modify: `components/applications-table.tsx`
- Modify: `components/dashboard.tsx`

- [ ] **Step 1: Dropdown for row actions**

Replace `ActionMenuState` positioned menu with HeroUI `Dropdown` from `components/ui/dropdown.tsx`.

- [ ] **Step 2: AnimatedList for table body rows**

- [ ] **Step 3: EmptyState + DotPattern**

- [ ] **Step 4: Commit**

```bash
git add components/applications-table.tsx components/dashboard.tsx
git commit -m "feat: HeroUI dropdown and Magic UI on Applications"
```

---

### Task 15: Companies (`/companies`)

**Files:**
- Modify: `components/discover-companies.tsx`

- [ ] **Step 1: MagicCard on company cards**

- [ ] **Step 2: Disclosure for industry filter collapse**

Replace manual show/hide with `Disclosure` wrapper where industry pills expand.

- [ ] **Step 3: AnimatedList for company grid rows and expanded postings**

- [ ] **Step 4: HeroUI Skeleton for posting fetch loading**

- [ ] **Step 5: Commit**

```bash
git add components/discover-companies.tsx
git commit -m "feat: HeroUI and Magic UI on Companies"
```

---

### Task 16: Alerts (`/alerts`)

**Files:**
- Modify: `components/alerts-page.tsx`
- Modify: `components/alert-filters-editor.tsx`
- Modify: `components/alert-subscription-filter-dialog.tsx`

- [ ] **Step 1: Disclosure for filter sections**

- [ ] **Step 2: Select/Autocomplete for add-company search**

Replace or augment `SearchInput` + manual list with HeroUI `Autocomplete` where company options are picked.

- [ ] **Step 3: MagicCard on subscription rows**

- [ ] **Step 4: BlurFade on page sections**

- [ ] **Step 5: Run full verify**

Run: `npm run verify`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/alerts-page.tsx components/alert-filters-editor.tsx components/alert-subscription-filter-dialog.tsx
git commit -m "feat: HeroUI and Magic UI on Alerts"
```

---

## Phase 2: Cleanup

### Task 17: Shared shell + dead code

**Files:**
- Modify: `components/route-skeletons.tsx`
- Delete or simplify: redundant framer row animations superseded by AnimatedList

- [ ] **Step 1: Confirm route-skeletons uses HeroUI Skeleton via SkeletonBlock re-export**

- [ ] **Step 2: Grep for `@/components/magic-ui` — should be zero**

Run: `rg "magic-ui" --glob '*.{ts,tsx}'`  
Expected: no matches

- [ ] **Step 3: Grep for `motion/react` — should be zero in app**

- [ ] **Step 4: Remove unused `@base-ui/react` from package.json if still unused**

- [ ] **Step 5: Final verify**

Run: `npm run verify`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: cleanup after HeroUI and Magic UI migration"
```

---

## Self-review checklist

| Spec requirement | Task |
| --- | --- |
| Magic UI registry + alias | Task 1 |
| Five Magic UI components installed | Task 2 |
| magic-ui → magicui rename | Task 3 |
| HeroUI wrappers | Tasks 4–8 |
| All 7 routes migrated | Tasks 10–16 |
| route-skeletons | Task 17 |
| docs/architecture.md | Task 9 |
| npm run verify | Tasks 10, 16, 17 |
