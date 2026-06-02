import type { ScrapedPostingRow } from "@/lib/discover/types";
import type { FeedPosting } from "@/lib/feed/types";

/** Minimal FeedPosting for Live row actions (track / save) on Discover listings. */
export function scrapedPostingToFeedPosting(
  posting: ScrapedPostingRow,
  companyName: string,
  companyWebsiteUrl: string | null = null,
  companyLogoAssetKey: string | null = null,
): FeedPosting {
  const locations = posting.location ? [posting.location] : [];

  return {
    id: posting.feedId,
    interactionIds: posting.interactionIds,
    sourceId: "",
    company: companyName,
    companyWebsiteUrl,
    companyLogoAssetKey,
    title: posting.roleName,
    url: posting.postingUrl,
    locations,
    countries: locations.length > 0 ? ["US"] : [],
    hasRemote: false,
    season: posting.season,
    datePosted: 0,
    pathwayNewUnix: 0,
    postedDisplay: posting.postedDisplay,
    dateUpdated: 0,
  };
}
