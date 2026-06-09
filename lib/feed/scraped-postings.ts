import {
  resolveEffectivePostedUnix,
  resolvePathwayNewUnix,
  resolvePostedDisplay,
  toUnixSeconds,
} from "./posted-display.ts";
import { stablePostingId } from "./ids.ts";
import { formatPlacesFromJson, placesFromJson } from "../geo/format.ts";
import type { LocationPlaceJson } from "../geo/types.ts";
import {
  detectCountriesAcross,
  hasRemoteLocation,
} from "./location.ts";
import { expandLocationSegments } from "./us-locations.ts";
import { feedPostingMatchesProductScope } from "./product-scope.ts";
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
  location_places: LocationPlaceJson[] | null;
  countries: string[] | null;
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

  const canonicalPlaces = placesFromJson(row.location_places);
  const fromPlaces = formatPlacesFromJson(row.location_places);
  const rawLocation = row.location?.trim() ?? "";
  if (fromPlaces.length === 0 && !rawLocation) {
    return null;
  }
  const locations =
    fromPlaces.length > 0
      ? fromPlaces
      : (() => {
          const segments = expandLocationSegments(rawLocation);
          return segments.length > 0 ? segments : [rawLocation];
        })();

  const storedCountries = (row.countries ?? []).map((code) => code.toUpperCase()).filter(Boolean);
  const countries =
    storedCountries.length > 0
      ? [...new Set(storedCountries)].sort()
      : detectCountriesAcross(locations);

  const hasRemote =
    row.location_places?.some((place) => place.remote) ??
    hasRemoteLocation(locations);
  const id = stablePostingId(url);
  const datePosted = resolveEffectivePostedUnix(row);
  const pathwayNewUnix = resolvePathwayNewUnix(row);
  const postedDisplay = resolvePostedDisplay(row);
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
    canonicalPlaces,
    countries,
    hasRemote,
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
      location_places,
      countries,
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
      location_places: raw.location_places ?? null,
      countries: raw.countries ?? null,
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
    if (!feedPostingMatchesProductScope(posting)) continue;
    postings.push(posting);
  }

  postings.sort((a, b) => b.datePosted - a.datePosted);
  return postings;
}

const FEED_POSTING_SELECT = `
  id,
  company_name,
  role_name,
  posting_url,
  season,
  location,
  location_places,
  countries,
  first_seen_at,
  last_seen_at,
  updated_at,
  companies!inner (
    slug,
    website_url,
    logo_asset_key
  )
`;

function mapRawScrapedFeedRow(raw: Record<string, unknown>): ScrapedPostingFeedRow | null {
  const company = Array.isArray(raw.companies) ? raw.companies[0] : raw.companies;
  if (!company || typeof company !== "object" || !("slug" in company)) {
    return null;
  }

  const companyRecord = company as {
    slug: string;
    website_url: string | null;
    logo_asset_key: string | null;
  };

  return {
    id: String(raw.id),
    company_name: String(raw.company_name),
    role_name: String(raw.role_name),
    posting_url: String(raw.posting_url),
    season: String(raw.season),
    location: (raw.location as string | null) ?? null,
    location_places: (raw.location_places as LocationPlaceJson[] | null) ?? null,
    countries: (raw.countries as string[] | null) ?? null,
    first_seen_at: String(raw.first_seen_at),
    last_seen_at: String(raw.last_seen_at),
    updated_at: String(raw.updated_at),
    companies: {
      slug: companyRecord.slug,
      website_url: companyRecord.website_url ?? null,
      logo_asset_key: companyRecord.logo_asset_key ?? null,
    },
  };
}

export async function loadFeedPostingsByPostingIds(
  supabase: SupabaseClient,
  postingIds: readonly string[],
): Promise<{ postings: FeedPosting[] }> {
  if (postingIds.length === 0) {
    return { postings: [] };
  }

  const { data, error } = await supabase
    .from("scraped_postings")
    .select(FEED_POSTING_SELECT)
    .in("id", [...postingIds])
    .eq("status", "open");

  if (error) throw error;

  const postings: FeedPosting[] = [];
  for (const raw of data ?? []) {
    const row = mapRawScrapedFeedRow(raw as Record<string, unknown>);
    if (!row) continue;
    const posting = mapScrapedRowToFeedPosting(row);
    if (!posting) continue;
    if (!feedPostingMatchesProductScope(posting)) continue;
    postings.push(posting);
  }

  return { postings };
}
