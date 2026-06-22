import "server-only";

import { unstable_noStore } from "next/cache";
import { loadScrapedFeedPostings } from "@/lib/feed/scraped-postings";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  LANDING_OPENINGS_LIMIT,
  selectLandingOpeningPreview,
} from "@/lib/landing/openings-preview";
import type { FeedPosting } from "@/lib/feed/types";

export interface LandingOpeningPreview {
  postings: FeedPosting[];
  totalRecentCount: number;
  hasLiveData: boolean;
}

export async function loadLandingOpeningPreview(): Promise<LandingOpeningPreview> {
  unstable_noStore();

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { postings: [], totalRecentCount: 0, hasLiveData: false };
  }

  try {
    const supabase = createAdminClient();
    const postings = await loadScrapedFeedPostings(supabase);
    const recentPostings = selectLandingOpeningPreview(postings, {
      limit: Number.POSITIVE_INFINITY,
    });

    return {
      postings: recentPostings.slice(0, LANDING_OPENINGS_LIMIT),
      totalRecentCount: recentPostings.length,
      hasLiveData: true,
    };
  } catch {
    return { postings: [], totalRecentCount: 0, hasLiveData: false };
  }
}
