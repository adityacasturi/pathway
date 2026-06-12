/** Tracking params that never identify a posting. */
const TRACKING_PARAM_PATTERN = /^(?:utm_|gh_src$|lever-|source$|src$|ref$|referrer$|gclid$|fbclid$)/i;

/**
 * Canonical form of a posting URL for deduplication and the `posting_url`
 * unique key: lowercase scheme/host, no hash, no tracking params, no
 * trailing slash. Returns the trimmed input when it is not a valid URL.
 */
export function canonicalizePostingUrl(raw: string): string {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    url.hash = "";
    const toDelete: string[] = [];
    url.searchParams.forEach((_value, key) => {
      if (TRACKING_PARAM_PATTERN.test(key)) {
        toDelete.push(key);
      }
    });
    for (const key of toDelete) {
      url.searchParams.delete(key);
    }
    // Param order must not affect identity: ?a=1&b=2 and ?b=2&a=1 are the same posting.
    url.searchParams.sort();
    let out = url.toString();
    if (url.pathname !== "/" && out.endsWith("/") && !url.search) {
      out = out.slice(0, -1);
    }
    return out;
  } catch {
    return trimmed;
  }
}
