import type { PostedDisplay } from "@/lib/feed/posted-display";
import type { FeedSeason } from "@/lib/feed/types";

export interface ScrapedPostingRow {
  /** Scraped row uuid (React key). */
  id: string;
  /** Stable feed id (`stablePostingId`); primary key for interactions. */
  feedId: string;
  /** URL-hash id plus row uuid — matches Live `FeedPosting.interactionIds`. */
  interactionIds: string[];
  roleName: string;
  postingUrl: string;
  season: FeedSeason;
  location: string | null;
  /** ISO timestamp for sort (effective posted or first_seen). */
  datePosted: string | null;
  postedDisplay: PostedDisplay;
}

export interface DiscoverCompanyCard {
  id: string;
  slug: string;
  name: string;
  websiteUrl: string | null;
  /** FK to discover_industries.slug */
  industry: string;
  industryLabel: string;
  openCount: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  /** Set when a static PNG is available at /company-logos/{slug}.png */
  logoAssetKey: string | null;
}
