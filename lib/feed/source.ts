/**
 * Live feed entry point. Postings are loaded from scraped ATS boards
 * stored in `scraped_postings` (see `lib/feed/scraped-postings.ts`).
 */

import { getCachedFeedPostings } from "@/lib/cache/catalog";

export type { FeedPosting, FeedSeason } from "@/lib/feed/types";
export { FEED_SEASONS } from "@/lib/feed/types";

/**
 * Loads open scraped internships for Openings. Cached globally and shared
 * across users because scraped_postings are the same catalog for everyone.
 */
export async function fetchFeed() {
  return getCachedFeedPostings();
}
