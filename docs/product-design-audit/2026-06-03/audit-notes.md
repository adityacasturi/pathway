# Pathway Product Design Audit

Date: 2026-06-03

## Scope

This audit used local screenshots from the running Next.js app at `http://127.0.0.1:3100`.

Protected Home, Applications, Live, Discover, Stats, Alerts, and Settings screens were captured with a QA account after credentials were provided. The first provided QA credential pair did not authenticate; the second provided account did.

## Captured Steps

1. Landing hero: `01-landing-hero.png`
   Health: Strong message and clear primary CTA, but product proof is below the first viewport.

2. Landing product anchor: `02-landing-product-section.png`
   Health: The section exists, but the anchor lands with a large blank band and low product visibility.

3. Login: `03-login.png`
   Health: Clean and focused, with good field spacing, but sparse recovery/help affordances.

4. Legacy signup query attempt: `04-signup.png`
   Health: A legacy login query rendered Sign in; the app now treats `/register` as the only signup route.

5. Register: `04-register.png`
   Health: Strong password feedback and simple form flow; long form sits low enough that bottom affordances can be clipped at 720px.

6. Protected route while signed out: `05-auth-redirect-login-wall.png`
   Health: Protected `/home` redirects to the public landing page, not a login page with return intent.

7. Authenticated Overview: `06-home-auth.png`
   Health: Strong compact command center with fresh roles visible immediately; next-best action guidance is still implicit.

8. Applications empty state: `07-applications-auth.png`
   Health: Clean layout and clear add action; active filters remain on a zero-data account, making the empty state slightly confusing.

9. Openings feed: `08-live-auth.png`
   Health: Dense, scannable, and useful; compact icon-only row actions require learning.

10. Companies: `09-discover-auth.png`
    Health: Strong catalog browsing surface; company names and open-count text truncate early in cards.

11. Insights: `10-stats-auth.png`
    Health: Clear metric hierarchy; a zero-data account exposes how descriptive the page is without giving the user a recommended next step.

12. Alerts: `11-alerts-auth.png`
    Health: Best exploratory surface in the app; sectors are tangible and easy to understand, but toggles/search can feel active before a user has chosen what they follow.

13. Settings: `12-settings-auth.png`
    Health: Very clean preference surface; Quick Track lacks visible explanation even though it changes tracking behavior materially.

## Highest-Impact Pain Points

1. Protected-route redirect loses user intent.

   Evidence: `05-auth-redirect-login-wall.png` shows `/home` as the landing hero when signed out.

   Why it matters: If a student follows a saved app link, browser history entry, or shared protected link, they are sent to marketing content instead of a sign-in action. This adds friction at the exact moment they already know what they want.

   Recommendation: Redirect unauthenticated protected routes to `/login?next=/requested-path` or show a compact sign-in interstitial. After successful auth, return to the requested route.

2. Product proof appears too late on the landing page.

   Evidence: `01-landing-hero.png` shows no actual app UI in the first viewport at 1280x720.

   Why it matters: The headline is clear, but the product category is still abstract until the user scrolls. For an internship tracker, users need to quickly see the feed/tracker shape to trust that this is not just another listing site.

   Recommendation: Bring a real product surface into the first viewport. A restrained, wide crop of Live or Home below the CTAs would preserve the quiet brand while giving immediate proof.

3. The "See it in action" anchor lands awkwardly.

   Evidence: `02-landing-product-section.png` shows a large blank top band and only a faded partial mock after navigating to `#product`.

   Why it matters: The secondary CTA promises product inspection, but the landing position delays the actual interface and makes the mock feel disabled or loading.

   Recommendation: Reduce the section top padding for anchor landings and make the first mock frame visible, crisp, and above the fold. Consider anchoring directly to the first product story card rather than the section heading.

4. Signup routing needed a single canonical route.

   Evidence: `04-signup.png` shows a legacy login query rendering Sign in; `04-register.png` shows the actual account creation route.

   Why it matters: Multiple signup entry concepts create broken handoffs from docs, old links, QA scripts, or product copy.

   Recommendation: Keep `/register` as the canonical signup route and remove product/docs references to query-mode signup.

5. Auth screens lack support actions.

   Evidence: `03-login.png` contains email, password, sign in, and create account only.

   Why it matters: Students will forget passwords, fail email confirmation, or arrive from protected links. The minimal layout is clean, but it does not help common recovery paths.

   Recommendation: Add a compact "Forgot password?" action, and when a `next` param exists, add one short line explaining that signing in will continue to the requested page.

6. Zero-data authenticated states need stronger first-run guidance.

   Evidence: `07-applications-auth.png` and `10-stats-auth.png` show a QA account with no applications. Applications says "Press N to add your first one"; Insights shows many zero/n/a cards.

   Why it matters: A new student can see the structure, but not the first meaningful workflow. The app has two plausible starts: add an application manually, or track one from Openings. The UI should make that choice explicit.

   Recommendation: In Applications, replace the bare empty state with two actions: "Add manually" and "Track from Openings". In Insights, show a small first-run panel explaining that metrics populate after applications and events are added.

7. Compact row actions are efficient but not self-explanatory.

   Evidence: `06-home-auth.png` and `08-live-auth.png` show plus, bookmark, and X controls in every posting row.

   Why it matters: The row is impressively dense, but first-time users must infer that plus means Track, bookmark means Save, and X means Dismiss. The distinction between Save and Track is especially important.

   Recommendation: Add hover/focus tooltips and consider a short onboarding hint above the first feed: "Track adds to your pipeline. Save keeps it for later. Dismiss hides it."

8. Company cards truncate too much signal.

   Evidence: `09-discover-auth.png` shows company cards where names such as Microsoft, Amazon, Susquehanna, and Neuralink truncate, and the open-role count line is also clipped.

   Why it matters: Discover is a browsing surface. If the company and count are both truncated, users lose confidence in what they are selecting.

   Recommendation: Widen card content, allow two-line company names, or move open-count text into a compact badge that does not compete with the name.

9. Alerts has strong content, but the setup sequence is not staged.

   Evidence: `11-alerts-auth.png` shows global digest and instant toggles before selected companies/sectors.

   Why it matters: A user can enable email before they have followed anything. That is logically valid, but the page does not make the setup order clear.

   Recommendation: Add a small selected-alerts summary near the toggles, e.g. "0 followed" with a disabled/empty explanation. Consider prompting users to pick companies or sectors first, then enable delivery.

## Authenticated Surface Opportunities

These are based on screenshots plus component review.

1. Home can become the command center.

   Current behavior already combines briefing, new postings, saved postings, starred alerts, and quick track. The opportunity is to make the next best action more explicit: "Review 12 new roles", "Follow up on 3 stale applications", "Star companies to improve alerts". This would reduce the cognitive jump between overview data and action.

2. Live and Discover share row actions, but their mental models differ.

   Live is a feed for triage: track, save, dismiss. Discover is a company-first exploration surface: star, inspect open roles, save/track. Consider adding a shared "why am I seeing this?" or source freshness line to both surfaces so students understand whether a role is new, reposted, saved, applied, or hidden.

3. Application rows depend on right-click for archive/delete.

   `ApplicationsTable` has a context menu with archive and delete. This is efficient for power users, but discoverability is low on touch devices and for keyboard users. Add an explicit row overflow button with the same menu, while keeping right-click as a shortcut.

4. Quick Track needs stronger user-facing explanation.

   Settings exposes "Quick track" as a switch with an ARIA label, but visible text does not explain the tradeoff. Because this setting changes whether Track opens a confirmation dialog or immediately creates an application, add one short visible description under the setting.

5. Alerts preview gate should set expectations.

   Alerts are launch-gated. If the preview gate blocks interaction, the page should make clear what the user can inspect now, what is disabled, and what will happen at launch. Keep it short; avoid turning the page into marketing copy.

6. Insights needs interpretation, not just metrics.

   Insights has strong metric cards and market data. The next extension is lightweight interpretation: call out one or two notable changes, such as "Your no-response rate is higher than last month" or "Quant roles are up this week". This makes the page actionable rather than purely descriptive.

## Accessibility Risks From Screenshots

1. The landing product mock in `02-landing-product-section.png` appears very low contrast. If this is intentional scroll animation, verify that it becomes readable quickly and respects reduced-motion preferences.

2. Login/register labels are small and uppercase. They are likely acceptable visually, but should be checked for color contrast and browser zoom behavior.

3. The register form can extend below a 720px viewport. Ensure keyboard focus, password help text, and the final alternate-sign-in link remain reachable without awkward scrolling.

4. Icon-only posting actions in authenticated rows use accessible labels in code, which is good. Add visible tooltip/focus treatment so sighted users can learn the icons without guessing.

## Suggested Next Iterations

1. Fix protected-route redirect intent and add `next` handling to login.

2. Tighten the landing first viewport by adding visible product proof before the fold.

3. Fix the product anchor so "See it in action" lands on an immediately inspectable mock.

4. Upgrade zero-data Applications and Insights states with first-run actions.

5. Add explicit overflow actions to application rows.

6. Add a concise Quick Track description in Settings.
