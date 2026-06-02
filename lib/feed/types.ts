import type { PostedDisplay } from "./posted-display.ts";

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
  /** ISO 3166-1 alpha-2 codes derived from `locations`. May be empty. */
  countries: string[];
  /** True if any location reads as remote; used for the Remote filter pill. */
  hasRemote: boolean;
  season: FeedSeason;
  /** Unix seconds for sort (effective publish or first_seen). */
  datePosted: number;
  /** Unix seconds for Live NEW badge (Pathway first_seen_at). */
  pathwayNewUnix: number;
  /** Relative-time source (publish when credible, else first_seen_at). */
  postedDisplay: PostedDisplay;
  dateUpdated: number;
}
