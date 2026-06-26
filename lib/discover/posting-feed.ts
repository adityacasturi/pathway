import type { ScrapedPostingRow } from "@/lib/discover/types";
import { hasAnyInteraction } from "@/lib/feed/interactions";
import { detectCountriesAcross, hasRemoteLocation } from "@/lib/feed/location";
import type { FeedPosting } from "@/lib/feed/types";
import { expandLocationSegments } from "@/lib/feed/us-locations";
import { normalizeUrl } from "@/lib/url";

export interface DiscoverPostingVisibilityState {
  trackedUrls: ReadonlySet<string>;
  dismissedIds: ReadonlySet<string>;
  showDismissed: boolean;
}

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
    canonicalPlaces: [],
    countries: detectCountriesAcross(segments.length > 0 ? segments : locations),
    hasRemote: hasRemoteLocation(segments.length > 0 ? segments : locations),
    season: posting.season,
    datePosted: 0,
    postedDisplay: posting.postedDisplay,
    dateUpdated: 0,
  };
}

export function isDiscoverPostingVisibleByState(
  posting: Pick<ScrapedPostingRow, "postingUrl" | "interactionIds">,
  state: DiscoverPostingVisibilityState,
): boolean {
  const key = normalizeUrl(posting.postingUrl) ?? posting.postingUrl;
  if (state.trackedUrls.has(key)) return false;

  if (!state.showDismissed && hasAnyInteraction(state.dismissedIds, posting.interactionIds)) {
    return false;
  }

  return true;
}
