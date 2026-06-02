/**
 * Shared publish-date extraction from Avature-hosted career HTML (IBM, Citi, Two Sigma, L3Harris, etc.).
 */

/** JSON-LD JobPosting `datePosted` embedded in detail pages. */
export function extractJsonLdDatePosted(html: string): string | null {
  const match = html.match(/"datePosted"\s*:\s*"([^"]+)"/i);
  return match?.[1]?.trim() || null;
}

/** Avature job detail sidebar date (e.g. Citi, some IBM portals). */
export function extractAvatureJobSidebarDatePosted(html: string): string | null {
  const match = html.match(
    /<div class="job-description__desc-job-info job-date">[\s\S]*?<p class="job-description__desc-detail">([^<]+)/i,
  );
  return match?.[1]?.trim() || null;
}

export function extractOpenGraphPublishedTime(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i,
    /<meta[^>]+property=["']og:published_time["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }
  return null;
}

/** Best-effort publish string from Avature-style job detail HTML. */
export function extractAvatureDetailDatePosted(html: string): string | null {
  return (
    extractJsonLdDatePosted(html) ??
    extractAvatureJobSidebarDatePosted(html) ??
    extractOpenGraphPublishedTime(html)
  );
}
