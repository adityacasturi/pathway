import {
  resolveEffectivePostedUnix,
  resolvePostedDisplay,
  toUnixSeconds,
} from "./posted-display.ts";
import { companyScopedPostingId, stablePostingId } from "./ids.ts";
import { formatCanonicalPlace, placesFromJson } from "../geo/format.ts";
import { countriesFromPlaces } from "../geo/countries.ts";
import type { LocationPlaceJson } from "../geo/types.ts";
import {
  detectCountriesAcross,
  hasRemoteLocation,
} from "./location.ts";
import { expandLocationSegments } from "./us-locations.ts";
import type { FeedPosting, FeedSeason } from "./types.ts";
import { FEED_SEASONS } from "./types.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSupabaseOk } from "@/lib/supabase/errors";

export interface ScrapedPostingFeedRow {
  id: string;
  company_name: string;
  role_name: string;
  posting_url: string;
  season: string | null;
  location: string | null;
  raw_location?: string | null;
  location_places: LocationPlaceJson[] | null;
  countries: string[] | null;
  first_seen_at: string;
  posted_at: string;
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

interface FeedPostingMapOptions {
  enabledCountryCodes?: readonly string[] | null;
}

function enabledCountrySet(options?: FeedPostingMapOptions): Set<string> | null {
  const codes = options?.enabledCountryCodes;
  if (!codes) return null;
  return new Set(codes.map((code) => code.toUpperCase()));
}

export function mapScrapedRowToFeedPosting(
  row: ScrapedPostingFeedRow,
  options?: FeedPostingMapOptions,
): FeedPosting | null {
  const url = row.posting_url?.trim();
  const company = row.company_name?.trim();
  const title = row.role_name?.trim();
  if (!url || !company || !title) return null;
  const seasonValue = row.season?.trim() ?? "";
  const season = isFeedSeason(seasonValue) ? seasonValue : null;

  const allCanonicalPlaces = placesFromJson(row.location_places);
  const allowedCountries = enabledCountrySet(options);
  const canonicalPlaces = allowedCountries
    ? allCanonicalPlaces.filter((place) => allowedCountries.has(place.countryCode.toUpperCase()))
    : allCanonicalPlaces;
  const fromPlaces = canonicalPlaces.map((place) => formatCanonicalPlace(place));
  // Honest fallback chain: resolved places → stored display → raw ATS string.
  // Postings with no location information at all are kept; the UI shows "Unknown".
  const rawLocation = row.location?.trim() || row.raw_location?.trim() || "";
  const locations =
    fromPlaces.length > 0
      ? fromPlaces
      : allowedCountries && allCanonicalPlaces.length > 0
        ? []
      : rawLocation
        ? (() => {
            const segments = expandLocationSegments(rawLocation);
            return segments.length > 0 ? segments : [rawLocation];
          })()
        : [];

  const storedCountries = (row.countries ?? []).map((code) => code.toUpperCase()).filter(Boolean);
  const countries =
    allowedCountries && canonicalPlaces.length > 0
      ? countriesFromPlaces(canonicalPlaces)
      : allowedCountries && allCanonicalPlaces.length > 0
        ? []
      : storedCountries.length > 0
      ? [...new Set(storedCountries)].sort()
      : detectCountriesAcross(locations);

  const hasRemote =
    canonicalPlaces.some((place) => place.remote) ||
    hasRemoteLocation(locations);
  const urlStableId = stablePostingId(url);
  const id = companyScopedPostingId(row.companies.slug, url);
  const datePosted = resolveEffectivePostedUnix(row);
  const postedDisplay = resolvePostedDisplay(row);
  const dateUpdated = Math.max(
    toUnixSeconds(row.last_seen_at),
    toUnixSeconds(row.updated_at),
    datePosted,
  );

  return {
    id,
    interactionIds: [urlStableId, row.id],
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
    postedDisplay,
    dateUpdated,
  };
}

async function loadEnabledCountryCodes(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from("allowed_countries")
    .select("country_code")
    .eq("enabled", true);

  assertSupabaseOk(error, "Load allowed countries");
  return (data ?? [])
    .map((row) => String(row.country_code ?? "").toUpperCase())
    .filter(Boolean);
}

const FEED_POSTING_SELECT = `
  id,
  company_name,
  role_name,
  posting_url,
  season,
  location,
  raw_location,
  location_places,
  countries,
  first_seen_at,
  posted_at,
  last_seen_at,
  updated_at,
  companies!inner (
    slug,
    website_url,
    logo_asset_key
  )
`;

const SCOPED_FEED_POSTING_SELECT = `
  id,
  company_name,
  role_name,
  posting_url,
  season,
  location,
  raw_location,
  location_places,
  countries,
  first_seen_at,
  posted_at,
  last_seen_at,
  updated_at,
  companies!inner (
    slug,
    website_url,
    logo_asset_key,
    company_sources!inner ( enabled )
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
    season: (raw.season as string | null) ?? null,
    location: (raw.location as string | null) ?? null,
    raw_location: (raw.raw_location as string | null) ?? null,
    location_places: (raw.location_places as LocationPlaceJson[] | null) ?? null,
    countries: (raw.countries as string[] | null) ?? null,
    first_seen_at: String(raw.first_seen_at),
    posted_at: String(raw.posted_at ?? raw.first_seen_at),
    last_seen_at: String(raw.last_seen_at),
    updated_at: String(raw.updated_at),
    companies: {
      slug: companyRecord.slug,
      website_url: companyRecord.website_url ?? null,
      logo_asset_key: companyRecord.logo_asset_key ?? null,
    },
  };
}

export async function loadScrapedFeedPostings(supabase: SupabaseClient): Promise<FeedPosting[]> {
  const enabledCountryCodes = await loadEnabledCountryCodes(supabase);

  const { data, error } = await supabase
    .from("scraped_postings")
    .select(SCOPED_FEED_POSTING_SELECT)
    .eq("status", "open")
    .eq("companies.is_active", true)
    .eq("companies.company_sources.enabled", true);

  assertSupabaseOk(error, "Load feed postings");

  const postings: FeedPosting[] = [];

  for (const raw of data ?? []) {
    const row = mapRawScrapedFeedRow(raw as Record<string, unknown>);
    if (!row) continue;
    const posting = mapScrapedRowToFeedPosting(row, { enabledCountryCodes });
    if (!posting) continue;
    postings.push(posting);
  }

  postings.sort((a, b) => b.datePosted - a.datePosted);
  return postings;
}

export async function loadFeedPostingsByPostingIds(
  supabase: SupabaseClient,
  postingIds: readonly string[],
): Promise<{ postings: FeedPosting[] }> {
  if (postingIds.length === 0) {
    return { postings: [] };
  }
  const enabledCountryCodes = await loadEnabledCountryCodes(supabase);

  const { data, error } = await supabase
    .from("scraped_postings")
    .select(FEED_POSTING_SELECT)
    .in("id", [...postingIds])
    .eq("status", "open");

  assertSupabaseOk(error, "Load feed postings by id");

  const postings: FeedPosting[] = [];
  for (const raw of data ?? []) {
    const row = mapRawScrapedFeedRow(raw as Record<string, unknown>);
    if (!row) continue;
    const posting = mapScrapedRowToFeedPosting(row, { enabledCountryCodes });
    if (!posting) continue;
    postings.push(posting);
  }

  return { postings };
}
