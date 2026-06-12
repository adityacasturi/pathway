import type { DiscoverIndustryCatalogItem } from "@/lib/discover/catalog";
import { loadDiscoverCompanyOpenCounts } from "@/lib/discover/open-counts";
import type { DiscoverCompanyCard, ScrapedPostingRow } from "@/lib/discover/types";
import { stablePostingId } from "@/lib/feed/ids";
import { resolvePostedDisplay } from "@/lib/feed/posted-display";
import type { FeedSeason } from "@/lib/feed/types";
import { FEED_SEASONS } from "@/lib/feed/types";
import type { SupabaseClient } from "@supabase/supabase-js";

interface CompanyRow {
  id: string;
  slug: string;
  name: string;
  website_url: string | null;
  logo_asset_key: string | null;
  industry: string | null;
  company_sources: Array<{
    source_type: string;
    last_success_at: string | null;
    last_failure_at: string | null;
    last_error_code: string | null;
  }>;
}

interface PostingRow {
  id: string;
  role_name: string;
  posting_url: string;
  season: string | null;
  location: string | null;
  raw_location?: string | null;
  location_places: import("@/lib/geo/types").LocationPlaceJson[] | null;
  countries: string[] | null;
  first_seen_at: string;
}

function mapPostingRow(row: PostingRow): ScrapedPostingRow | null {
  // Honest fallback: normalized display → raw ATS string → null ("Unknown" in UI).
  const normalizedLocation = row.location?.trim() || row.raw_location?.trim() || null;

  const seasonValue = row.season?.trim() ?? "";
  const season = (FEED_SEASONS as readonly string[]).includes(seasonValue)
    ? (seasonValue as FeedSeason)
    : null;
  const postedDisplay = resolvePostedDisplay(row);
  const displayIso = postedDisplay.kind === "added" ? row.first_seen_at : null;

  const url = row.posting_url.trim();
  const feedId = stablePostingId(url);

  return {
    id: row.id,
    feedId,
    interactionIds: [feedId, row.id],
    roleName: row.role_name,
    postingUrl: row.posting_url,
    season,
    location: normalizedLocation,
    datePosted: displayIso,
    postedDisplay,
  };
}

export async function loadDiscoverCompanies(
  supabase: SupabaseClient,
  industryCatalog: DiscoverIndustryCatalogItem[],
): Promise<DiscoverCompanyCard[]> {
  const [companiesRes, openCounts] = await Promise.all([
    supabase
      .from("companies")
      .select(
        `
        id,
        slug,
        name,
        website_url,
        logo_asset_key,
        industry,
        company_sources!inner (
          source_type,
          last_success_at,
          last_failure_at,
          last_error_code
        )
      `,
      )
      .eq("is_active", true)
      .eq("company_sources.enabled", true)
      .order("name", { ascending: true }),
    loadDiscoverCompanyOpenCounts(supabase),
  ]);

  if (companiesRes.error) {
    throw companiesRes.error;
  }

  const labelByIndustry = new Map(industryCatalog.map((item) => [item.slug, item.label]));

  return ((companiesRes.data ?? []) as CompanyRow[]).map((company) => {
    const source = company.company_sources[0];
    const industry = company.industry?.trim();
    if (!industry) {
      throw new Error(`Missing industry for company ${company.slug}`);
    }
    const industryLabel = labelByIndustry.get(industry);
    if (!industryLabel) {
      throw new Error(`Unknown industry "${industry}" for company ${company.slug}`);
    }
    return {
      id: company.id,
      slug: company.slug,
      name: company.name,
      websiteUrl: company.website_url,
      industry,
      industryLabel,
      openCount: openCounts.get(company.id) ?? 0,
      sourceType: source?.source_type ?? "",
      lastSuccessAt: source?.last_success_at ?? null,
      lastFailureAt: source?.last_failure_at ?? null,
      lastErrorCode: source?.last_error_code ?? null,
      logoAssetKey: company.logo_asset_key?.trim() || null,
    };
  });
}

export async function loadDiscoverCompanyPostings(
  supabase: SupabaseClient,
  companyId: string,
): Promise<ScrapedPostingRow[]> {
  const { data, error } = await supabase
    .from("scraped_postings")
    .select("id, role_name, posting_url, season, location, raw_location, location_places, countries, first_seen_at")
    .eq("company_id", companyId)
    .eq("status", "open")
    .order("first_seen_at", { ascending: false })
    .order("role_name", { ascending: true });

  if (error) {
    throw error;
  }

  const postings: ScrapedPostingRow[] = [];
  for (const row of (data ?? []) as PostingRow[]) {
    const mapped = mapPostingRow(row);
    if (mapped) {
      postings.push(mapped);
    }
  }
  return postings;
}
