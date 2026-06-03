import type { PostedDateConfidence, PostedDateSource } from "../scraping/posted-date.ts";
import {
  resolveEffectivePostedUnix,
  resolvePathwayNewUnix,
  resolvePostedDisplay,
  toUnixSeconds,
} from "./posted-display.ts";
import { stablePostingId } from "./ids.ts";
import {
  detectCountriesAcross,
  hasRemoteLocation,
} from "./location.ts";
import { expandLocationSegments } from "./us-locations.ts";
import type { FeedPosting, FeedSeason } from "./types.ts";
import { FEED_SEASONS } from "./types.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ScrapedPostingFeedRow {
  id: string;
  company_name: string;
  role_name: string;
  posting_url: string;
  season: string;
  location: string | null;
  date_posted: string | null;
  date_posted_source: PostedDateSource;
  date_posted_confidence: PostedDateConfidence;
  first_seen_at: string;
  last_seen_at: string;
  updated_at: string;
  companies: {
    slug: string;
    website_url: string | null;
    logo_asset_key: string | null;
  };
}

function isFeedSeason(season: string): season is FeedSeason {
  return (FEED_SEASONS as readonly string[]).includes(season);
}

export function mapScrapedRowToFeedPosting(row: ScrapedPostingFeedRow): FeedPosting | null {
  const url = row.posting_url?.trim();
  const company = row.company_name?.trim();
  const title = row.role_name?.trim();
  if (!url || !company || !title) return null;
  const season = row.season.trim();
  if (!isFeedSeason(season)) return null;

  const rawLocation = row.location?.trim() ?? "";
  if (!rawLocation) {
    return null;
  }
  const segments = expandLocationSegments(rawLocation);
  const locations = [rawLocation];
  const id = stablePostingId(url);
  const dateFields = {
    date_posted: row.date_posted,
    date_posted_source: row.date_posted_source,
    date_posted_confidence: row.date_posted_confidence,
    first_seen_at: row.first_seen_at,
  };
  const datePosted = resolveEffectivePostedUnix(dateFields);
  const pathwayNewUnix = resolvePathwayNewUnix(row);
  const postedDisplay = resolvePostedDisplay(dateFields);
  const dateUpdated = Math.max(
    toUnixSeconds(row.last_seen_at),
    toUnixSeconds(row.updated_at),
    datePosted,
  );

  return {
    id,
    interactionIds: [id, row.id],
    sourceId: `company:${row.companies.slug}`,
    company,
    companyWebsiteUrl: row.companies.website_url?.trim() || null,
    companyLogoAssetKey: row.companies.logo_asset_key?.trim() || null,
    title,
    url,
    locations,
    countries: detectCountriesAcross(segments.length > 0 ? segments : locations),
    hasRemote: hasRemoteLocation(segments.length > 0 ? segments : locations),
    season,
    datePosted,
    pathwayNewUnix,
    postedDisplay,
    dateUpdated,
  };
}

async function loadEligibleCompanyIds(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("id, company_sources!inner ( enabled )")
    .eq("is_active", true)
    .eq("company_sources.enabled", true);

  if (error) throw error;
  return ((data ?? []) as { id: string }[]).map((row) => row.id);
}

export async function loadScrapedFeedPostings(supabase: SupabaseClient): Promise<FeedPosting[]> {
  const companyIds = await loadEligibleCompanyIds(supabase);
  if (companyIds.length === 0) return [];

  const { data, error } = await supabase
    .from("scraped_postings")
    .select(
      `
      id,
      company_name,
      role_name,
      posting_url,
      season,
      location,
      date_posted,
      date_posted_source,
      date_posted_confidence,
      first_seen_at,
      last_seen_at,
      updated_at,
      companies!inner (
        slug,
        website_url,
        logo_asset_key
      )
    `,
    )
    .eq("status", "open")
    .in("company_id", companyIds);

  if (error) throw error;

  const postings: FeedPosting[] = [];

  for (const raw of data ?? []) {
    const company = Array.isArray(raw.companies) ? raw.companies[0] : raw.companies;
    if (!company?.slug) continue;
    const row: ScrapedPostingFeedRow = {
      id: raw.id,
      company_name: raw.company_name,
      role_name: raw.role_name,
      posting_url: raw.posting_url,
      season: raw.season,
      location: raw.location,
      date_posted: raw.date_posted,
      date_posted_source: raw.date_posted_source ?? "unknown",
      date_posted_confidence: raw.date_posted_confidence ?? "unknown",
      first_seen_at: raw.first_seen_at,
      last_seen_at: raw.last_seen_at,
      updated_at: raw.updated_at,
      companies: {
        slug: company.slug,
        website_url: company.website_url ?? null,
        logo_asset_key: company.logo_asset_key ?? null,
      },
    };
    const posting = mapScrapedRowToFeedPosting(row);
    if (!posting) continue;
    postings.push(posting);
  }

  postings.sort((a, b) => b.datePosted - a.datePosted);
  return postings;
}
