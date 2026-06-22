import type { PostedDisplay } from "./posted-display.ts";
import type { CanonicalPlace } from "../geo/types.ts";

export type FeedSeason = "Summer" | "Fall" | "Spring" | "Winter";

export const FEED_SEASONS: readonly FeedSeason[] = ["Summer", "Fall", "Spring", "Winter"];

/** Slim shape handed down to client components. */
export interface FeedPosting {
  id: string;
  interactionIds: string[];
  sourceId: string;
  company: string;
  /** Company site for logo.dev domain lookup; null when unknown. */
  companyWebsiteUrl: string | null;
  /** Static logo at /company-logos/{slug}.png when set in catalog. */
  companyLogoAssetKey: string | null;
  title: string;
  url: string;
  locations: string[];
  /** Structured places from scrape-time geo resolution. */
  canonicalPlaces: CanonicalPlace[];
  /** ISO 3166-1 alpha-2 codes derived from `locations`. May be empty. */
  countries: string[];
  /** True if any location reads as remote; used for the Remote filter pill. */
  hasRemote: boolean;
  /** Scraped postings default to Summer when the source states no season. */
  season: FeedSeason | null;
  /** Unix seconds for sort (`posted_at`, falling back to `first_seen_at`). */
  datePosted: number;
  /** Unix seconds for Live NEW badge (`posted_at`, falling back to `first_seen_at`). */
  pathwayNewUnix: number;
  /** Relative-time source (`posted_at`, falling back to `first_seen_at`). */
  postedDisplay: PostedDisplay;
  dateUpdated: number;
}
