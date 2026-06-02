/**
 * Lightweight title heuristics shared by scrape adapters.
 *
 * Adapters use {@link INTERNSHIP_LIST_TITLE_PATTERN} as a cheap pre-filter on a
 * job board's listing view (title/summary) to decide whether a posting is worth
 * fetching detail for or running through the authoritative classifier in
 * `classify-role.ts`. It is intentionally broad and is NOT the source of truth
 * for inclusion — that remains `classifyForSource`.
 *
 * Some boards use company-specific vocabulary (e.g. "splunktern", "summer
 * analyst"). Build those variants with {@link buildInternshipListTitlePattern}
 * so they extend the shared base instead of copying it.
 */

/** Base tokens that signal an early-career / internship-style posting. */
const BASE_INTERNSHIP_LIST_TOKENS = [
  "\\bintern(?:ship|ships)?\\b",
  "\\bco-?op\\b",
  "\\bfellowship\\b",
  "\\buniversity\\b",
];

/**
 * Build a case-insensitive internship listing pattern from the shared base plus
 * any extra raw regex token sources (already escaped / anchored as needed).
 */
export function buildInternshipListTitlePattern(...extraTokens: string[]): RegExp {
  return new RegExp([...BASE_INTERNSHIP_LIST_TOKENS, ...extraTokens].join("|"), "i");
}

/** The shared base pattern used by the majority of adapters. */
export const INTERNSHIP_LIST_TITLE_PATTERN = buildInternshipListTitlePattern();
