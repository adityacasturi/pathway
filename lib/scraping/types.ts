import type { PostingSeason, SeasonSource } from "./normalize.ts";

export type SourceType = "ashby" | "greenhouse" | "lever" | "workday" | "custom" | "manual";
export type DatePostedSource = "ats" | "page" | "inferred" | "unknown";

export interface ScrapeSourceConfig {
  companySlug: string;
  companyName: string;
  sourceType: SourceType;
  adapterKey: string;
  sourceUrl: string;
  boardToken?: string;
}

export interface NormalizedScrapedPosting {
  companySlug: string;
  companyName: string;
  roleName: string;
  roleNameRaw: string;
  postingUrl: string;
  canonicalUrl: string;
  externalJobId: string | null;
  datePosted: string | null;
  datePostedSource: DatePostedSource;
  season: PostingSeason;
  seasonYear: number | null;
  seasonSource: SeasonSource;
  locations: string[];
  locationRaw: string | null;
  countries: string[];
  isRemote: boolean;
  contentHash: string;
  metadata?: Record<string, unknown>;
}

export interface ScrapeAdapter {
  source: ScrapeSourceConfig;
  fetchPostings: () => Promise<NormalizedScrapedPosting[]>;
}

export interface ScrapeSummary {
  company: string;
  source: string;
  found: number;
  inserted: number;
  updated: number;
  unchanged: number;
  markedStale: number;
}
