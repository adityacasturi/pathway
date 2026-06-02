/**
 * Stable posting identifiers derived from canonical apply URLs.
 * Shared by Live feed interactions (`feed_interactions`) and scraped loaders.
 */

export function urlDedupeKey(url: string): string {
  try {
    const u = new URL(url);
    const host = u.host.toLowerCase().replace(/^www\./, "");
    const pathname = u.pathname.replace(/\/+$/, "");
    return `${host}${pathname}${u.search}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function stablePostingId(url: string): string {
  return `job_${stableHash(urlDedupeKey(url))}`;
}
