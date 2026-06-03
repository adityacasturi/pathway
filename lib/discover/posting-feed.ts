import type { ScrapedPostingRow } from "@/lib/discover/types";
import { detectCountriesAcross, hasRemoteLocation } from "@/lib/feed/location";
import type { FeedPosting } from "@/lib/feed/types";
import { expandLocationSegments } from "@/lib/feed/us-locations";

/** Minimal FeedPosting for Live row actions (track / save) on Discover listings. */
export function scrapedPostingToFeedPosting(
  posting: ScrapedPostingRow,
  companyName: string,
  companyWebsiteUrl: string | null = null,
  companyLogoAssetKey: string | null = null,
): FeedPosting {
  const locations = posting.location ? [posting.location] : [];
  const segments = posting.location ? expandLocationSegments(posting.location) : [];

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
    countries: detectCountriesAcross(segments.length > 0 ? segments : locations),
    hasRemote: hasRemoteLocation(segments.length > 0 ? segments : locations),
    season: posting.season,
    datePosted: 0,
    pathwayNewUnix: 0,
    postedDisplay: posting.postedDisplay,
    dateUpdated: 0,
  };
}
