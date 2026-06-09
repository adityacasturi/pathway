/**
 * Live feed entry point. Postings are loaded from scraped ATS boards
 * stored in `scraped_postings` (see `lib/feed/scraped-postings.ts`).
 */

import { unstable_noStore } from "next/cache";
import { loadScrapedFeedPostings } from "@/lib/feed/scraped-postings";
import { createClient } from "@/lib/supabase/server";

export type { FeedPosting, FeedSeason } from "@/lib/feed/types";
export { FEED_SEASONS } from "@/lib/feed/types";

/**
 * Loads open scraped internships for Openings. Uses the request-scoped
 * Supabase client so RLS applies; scraped_postings are readable by authenticated users.
 */
export async function fetchFeed() {
  unstable_noStore();
  const supabase = await createClient();
  return loadScrapedFeedPostings(supabase);
}
