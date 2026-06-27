import "server-only";

import { getCachedFeedPostings } from "@/lib/cache/catalog";
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
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { postings: [], totalRecentCount: 0, hasLiveData: false };
  }

  try {
    const postings = await getCachedFeedPostings();
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
