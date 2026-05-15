# Landing Page Redesign — Premium Dark, "Operating System for Ambitious Candidates"

Status: approved (2026-05-13).

## Goal

Rebuild the public landing as a high-prestige dark surface that sells the dream of elite internships at companies like Google, NVIDIA, Citadel, Jane Street, Hudson River Trading, Meta, Apple, and OpenAI. The page should make a Tier-1-CS student think *"people who land roles at those companies use this — I should be using this too."* It should feel like Linear, Vercel, Raycast, and a quant trading dashboard had a career-focused product child: precise, dense with signal, quietly elite.

## Non-goals

- Dark mode for the rest of the app. Out of scope; landing only. Tokens are scoped so the future extension is an attribute flip.
- Real testimonials, pricing, FAQ, blog, investor logos, metrics block. We have none of these honestly; we don't fabricate them.
- Mobile-specific reimagining beyond responsive defaults. We design desktop-first and let the breakpoints handle phones gracefully.

## Approach

A single dark route at `/`, rebuilt from scratch, composed of small focused section components under `components/landing/`. The dark token set lives in `app/globals.css` under `[data-theme="dark"]` so the same tokens drive the eventual app dark mode. Real signal (live posting counts) feeds the hero subhead; curated company and school logos drive social proof. No invented metrics, no fake testimonials.

## Page structure

Top-to-bottom, each section is its own component file.

### Nav (`components/landing/nav.tsx`)

Sticky, dark-glass (`backdrop-filter: blur(20px)` + 4% white fill), 1px bottom hairline (`rgba(255,255,255,0.08)`).

- Left: Pathway wordmark linking to `/`.
- Right: `Sign in` (ghost button, white at 70% opacity, hover to 100%) and `Get started →` (sage-glow primary).

### Hero (`components/landing/hero.tsx`)

Full-viewport height (`min-h-[88vh]`), centered content, near-black canvas with a subtle 32×32 grid overlay (inline SVG, `rgba(255,255,255,0.035)`) and a radial sage spotlight emerging from the bottom-center (`radial-gradient(ellipse at 50% 110%, sage-glow 0%, transparent 50%)`).

- Eyebrow (monospace, uppercase, wide tracking): `BUILT FOR THE AMBITIOUS`
- Headline (serif, very large, italic-underscored emphasis):
  `The operating system for ` + `<em>` `ambitious` `</em>` + ` candidates.`
- Subhead (sans, muted): `Tracking ${postingCount} live internships from elite engineering, quant, and research teams.` — falls back to `Tracking the roles that matter` if the feed returns 0 or fails.
- Primary CTA: `Get started →` (sage glow, prominent). Secondary CTA: `Sign in` (ghost).
- Scroll cue at the bottom edge — repurpose `LandingScrollCue`, restyle for dark.

### Target-companies marquee (`components/landing/company-marquee.tsx`)

A slightly-recessed band (`bg-[rgba(255,255,255,0.02)]`, hairlines top + bottom).

- Eyebrow centered: `BUILT AROUND THE ROLES THAT MATTER`.
- Below: a single row of company wordmarks/logo marks scrolling left at a slow constant velocity (~30s for one full loop). Pure CSS `@keyframes` translateX animation on a doubled list. Pause on hover. Disabled when `prefers-reduced-motion: reduce`.
- Logos rendered at uniform height (~22px), monochrome white (`filter: brightness(0) invert(1)`) at ~75% opacity. Hover brings to 100%.
- Logo list source: `lib/config/dream-companies.ts` — 12 entries for the marquee. Logos fetched via `/api/logo` (existing route, uses `LOGO_DEV_TOKEN`).

### Dream targets grid (`components/landing/dream-targets.tsx`)

Section header:
- Eyebrow: `THE TARGETS`.
- Headline (serif, italic-underscore): `Treat every role like a ` + `<em>` `target` `</em>` + `.`
- Sub (sans, muted): `Pathway treats elite companies as first-class objects — track velocity, deadlines, and signal per role.`

Grid: 4 cols × 2 rows (8 cards). Responsive: 2 cols on tablet, 1 col on phone.

Each card:
- Surface: glass (`bg-[rgba(255,255,255,0.04)]`, blur, 1px hairline).
- Top-left: company logo (28px square).
- Top-right: small status chip (`Open · Summer 26`, `Closed`, `Coming Soon`) — monospace, uppercase, very subtle.
- Body: company name (sans, medium weight, white at 95%), role count (`{N} live roles`, muted).
- Hover: card lifts 2px, hairline brightens to `rgba(255,255,255,0.18)`, sage-glow shadow appears.

Source: same `lib/config/dream-companies.ts`, 8 entries marked `featured: true`. Role counts come from the live feed (server-fetched in `page.tsx`, joined into the data).

### Product story (`components/landing/product-story.tsx`)

Replaces existing `LandingProductStory`. Three stops, not five.

Each stop is a horizontally-split section:
- Left: text — monospace eyebrow (`01 / DISCOVER`), serif headline with italic-underscore, body copy.
- Right: screenshot wrapped in a "dark glass" frame — 1px hairline, subtle inner sage-glow on hover, slight 3D tilt on scroll-into-view (transform-based, no library).

Stops:
1. `01 / DISCOVER` — `Find the roles that ` + `<em>` `matter` `</em>` + `.` (uses `landing-discover.png`)
2. `02 / TRACK` — `A pipeline built like ` + `<em>` `mission control` `</em>` + `.` (uses `landing-applications.png`)
3. `03 / DECIDE` — `See your search ` + `<em>` `move` `</em>` + `.` (uses `landing-stats.png`)

Animation: each section's content fades in + translates up 8px when its top crosses 70vh. Once only. Respects reduced-motion.

### Schools band (`components/landing/schools-band.tsx`)

Slim section, hairlines top + bottom.
- Eyebrow centered: `BUILT FIRST FOR UW. COMING TO TOP CS PROGRAMS.`
- School logos rendered monochrome white at ~60% opacity in a single row, separated by vertical hairlines. Wraps gracefully on narrow viewports.
- Source: existing `/public/school-logos/`.

### Final CTA (`components/landing/cta-section.tsx`)

Tall section (`min-h-[60vh]`), monolithic dark, faint dashboard image fading behind (`opacity: 0.04`, blurred), sage radial spotlight from top-center.
- Headline (very large serif): `Start your ` + `<em>` `path` `</em>` + `.`
- Subhead: `Free for @uw.edu students. Spring 26 cohort open now.`
- Primary CTA: `Get started →` (sage glow).

### Footer (`components/landing/footer.tsx`)

Quiet. Single row.
- Left: wordmark + `© 2026 Pathway`.
- Right: `Sign in`, optionally `Privacy`, `Terms` if those routes exist (currently they don't — omit until they do).

## Visual language

### Tokens (added to `app/globals.css`)

Scoped under `[data-theme="dark"]`:

```css
[data-theme="dark"] {
  --background: oklch(0.12 0.005 250);     /* near-black */
  --foreground: oklch(0.97 0.002 250);     /* off-white */
  --card: oklch(0.16 0.005 250);
  --card-foreground: var(--foreground);
  --muted: oklch(0.22 0.005 250);
  --muted-foreground: oklch(0.62 0.005 250);
  --rule: oklch(1 0 0 / 0.08);
  --rule-strong: oklch(1 0 0 / 0.18);
  --primary: oklch(0.78 0.12 150);         /* brighter sage for dark */
  --primary-foreground: oklch(0.12 0.005 250);
  --accent: oklch(0.30 0.06 150);
  --accent-foreground: var(--foreground);
  --primary-glow:
    0 0 0 1px color-mix(in oklab, var(--primary) 40%, transparent),
    0 8px 32px -8px color-mix(in oklab, var(--primary) 35%, transparent);
}
```

These reuse existing token *names*, so any component that already consumes `var(--background)` etc. inherits dark colors when nested under a `[data-theme="dark"]` ancestor. The landing's `<main>` (or a wrapping `<div>` in `app/page.tsx`) sets `data-theme="dark"` to scope the inversion.

### Type

- Display: existing serif at larger sizes (3.5rem–7rem). On dark, this reads as intellectual rather than corporate.
- Eyebrows/labels: monospace, 11px, `tracking-[0.22em]`, uppercase, color `--muted-foreground`.
- Body: existing sans, 15–17px, line-height 1.55, color at 80% foreground for "calm" copy and 100% for emphasis.
- Recurring motif: `<em>` styled to italic + slightly brighter than surrounding text. No real underscore, just italic — the underscore in the brief is the markdown rendering; the visual is italic only. (Optional second pass: add a thin `text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 6px` if italic alone reads too quiet.)

### Motion

- Section entrances: scroll-driven fade + 8px upward translation, ~280ms ease-out, fire once. Skip when reduced-motion is set.
- Marquee: linear, ~30s loop, pause on hover, kill on reduced-motion.
- Hover on cards: 160ms — lift, hairline brightness, glow.
- No bounces, no springs. Smooth and terse.

### Glow / depth

- `--primary-glow` is the canonical sage glow box-shadow. Applied to the primary CTA, sparingly to hovered cards.
- Hairlines are the only line element. No thick borders. Never use plain `border` without explicit color from token.

## Copy

| Slot | Text |
|---|---|
| Nav primary CTA | `Get started →` |
| Nav secondary | `Sign in` |
| Hero eyebrow | `BUILT FOR THE AMBITIOUS` |
| Hero headline | `The operating system for `*`ambitious`*` candidates.` |
| Hero subhead | `Tracking {N} live internships from elite engineering, quant, and research teams.` |
| Marquee eyebrow | `BUILT AROUND THE ROLES THAT MATTER` |
| Targets eyebrow | `THE TARGETS` |
| Targets headline | `Treat every role like a `*`target`*`.` |
| Targets sub | `Pathway treats elite companies as first-class objects — track velocity, deadlines, and signal per role.` |
| Story 01 | `01 / DISCOVER` · `Find the roles that `*`matter`*`.` |
| Story 02 | `02 / TRACK` · `A pipeline built like `*`mission control`*`.` |
| Story 03 | `03 / DECIDE` · `See your search `*`move`*`.` |
| Schools band | `BUILT FIRST FOR UW. COMING TO TOP CS PROGRAMS.` |
| Final headline | `Start your `*`path`*`.` |
| Final sub | `Free for @uw.edu students. Spring 26 cohort open now.` |

`*x*` denotes italic emphasis (`<em>`).

## Data flow

`app/page.tsx` is a server component (already is). On request:

1. Auth check (existing) — authenticated users redirect to `/home`.
2. Server-fetch the live feed via existing `lib/feed/source.ts`.
3. Compute `postingCount = activeVisiblePostings.length` and a `companyRoleCounts: Map<companyDomain, number>` for the dream-targets cards.
4. Read the curated `DREAM_COMPANIES` array from `lib/config/dream-companies.ts`. Join role counts in.
5. Pass `{ postingCount, dreamCompanies, marqueeCompanies }` to the page subtree.

On feed fetch failure: catch, log, fall back. `postingCount = null` → hero uses the static fallback copy. `dreamCompanies` defaults to the curated list with `roleCount: null` → cards omit the count line.

## Assets

- **Curated company list** (`lib/config/dream-companies.ts`): exports `MARQUEE_COMPANIES` (12 entries) and `DREAM_COMPANIES` (8 entries — subset). Each entry: `{ name, domain, logoUrl?, featured?: boolean }`. Initial roster: Google, NVIDIA, Citadel, Jane Street, Hudson River Trading, Meta, Apple, OpenAI, Two Sigma, Anthropic, Stripe, Databricks. Featured (dream targets): Google, NVIDIA, Citadel, Jane Street, HRT, Meta, OpenAI, Anthropic.
- **Logos**: fetched via existing `/api/logo` route (already uses `LOGO_DEV_TOKEN`). `<Image>` with `priority` for above-fold logos. Background fallback for the 1-in-N case where logo.dev returns nothing: render the company name in a small monospace tag.
- **School logos**: existing `/public/school-logos/`.
- **Grid background**: inline SVG, no asset.
- **Final-CTA backdrop**: existing `landing-home.png` at 4% opacity + blur. No new asset.

## Components & files

```
app/page.tsx                                # full rewrite, server component
app/globals.css                             # add [data-theme="dark"] block
components/landing/nav.tsx
components/landing/hero.tsx
components/landing/company-marquee.tsx
components/landing/dream-targets.tsx
components/landing/product-story.tsx
components/landing/schools-band.tsx
components/landing/cta-section.tsx
components/landing/footer.tsx
lib/config/dream-companies.ts
```

Files removed:
- `components/landing-product-story.tsx` (superseded by `components/landing/product-story.tsx`)
- `components/landing-scroll-cue.tsx` (recreated inside hero, restyled for dark; or kept if reusable)

Files preserved:
- `components/school-logo-carousel.tsx` (used by `schools-band.tsx`)
- `components/waitlist-dialog.tsx` (intentionally orphaned, per earlier decision)

## Performance & accessibility

- All sections lazy-evaluate motion via `IntersectionObserver`; nothing animates that isn't on-screen.
- `prefers-reduced-motion` kills marquee, scroll-driven fades, hover lifts.
- Contrast: foreground `oklch(0.97)` on background `oklch(0.12)` is well above AA. CTA sage on dark also above AA.
- Keyboard: nav, CTAs, and dream-target cards are real `<a>` / `<button>` elements with visible focus rings (`outline: 2px solid var(--primary)` on focus-visible).
- Images: `next/image` everywhere except the inline SVG grid. Marquee logos use `priority` for the first viewport's worth.

## Testing & rollout

- **Manual smoke test**: hard-refresh `/`, scroll the page, check marquee runs, check hover on dream-target cards, check CTAs route to `/login` / `/login?mode=signup`, check authenticated users still redirect to `/home`.
- **Reduced-motion test**: enable `prefers-reduced-motion` and verify nothing animates.
- **Lighthouse**: aim for ≥90 on Performance and 100 on Accessibility. Acceptable to drop slightly on Performance if marquee logos dominate the LCP — mitigate with width/height hints and `priority`.
- **`npm run verify`** must pass.
- **Rollout**: single commit (or small chain). No flag — the redesign replaces the old landing entirely. Old `components/landing-product-story.tsx` and `landing-scroll-cue.tsx` deleted in the same change.

## Risks & tradeoffs

- **Brand seam between dark landing and light app**: intentional, common (Vercel, Linear marketing). Accepted.
- **Logo.dev cost/rate**: 12 marquee logos × every page load. Mitigation: rely on Next.js/Vercel image cache; logos virtually never change.
- **Postings count volatility**: handled by fallback copy when feed returns 0 or errors.
- **Italic-as-emphasis** alone may read quiet on small screens; left in the spec but flagged as a place to test in implementation. Optional underline can be added with one CSS rule if needed.

## Implementation order

1. Add `[data-theme="dark"]` token block to `globals.css`.
2. Create `lib/config/dream-companies.ts`.
3. Rewrite `app/page.tsx` scaffold (server data fetch + section composition).
4. Build sections in vertical order: `nav` → `hero` → `company-marquee` → `dream-targets` → `product-story` → `schools-band` → `cta-section` → `footer`.
5. Delete superseded `components/landing-product-story.tsx`.
6. Run `npm run verify`; smoke test; iterate on copy or spacing if anything reads off.

## Open questions

None.
