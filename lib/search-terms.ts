/** Splits a query into lowercase terms, honoring quoted phrases. */
const SEARCH_TOKEN_PATTERN = /"[^"]*"|'[^']*'|\S+/g;

/**
 * Tokenize a free-text search query into normalized terms. Quoted spans are
 * kept as a single term; surrounding quotes and whitespace are stripped and
 * everything is lowercased so callers can do simple `includes` matching.
 */
export function getSearchTerms(value: string): string[] {
  return (value.match(SEARCH_TOKEN_PATTERN) ?? [])
    .map((term) => term.replace(/^["']|["']$/g, "").trim().toLowerCase())
    .filter(Boolean);
}
