import type { DiscoverIndustryCatalogItem } from "@/lib/discover/catalog";
import type { DiscoverCompanyCard, ScrapedPostingRow } from "@/lib/discover/types";
import { stablePostingId } from "@/lib/feed/ids";
import { resolvePostedDisplay } from "@/lib/feed/posted-display";
import type { FeedSeason } from "@/lib/feed/types";
import { FEED_SEASONS } from "@/lib/feed/types";
import { normalizeScrapedLocationField } from "@/lib/scraping/location";
import type { PostedDateConfidence, PostedDateSource } from "@/lib/scraping/posted-date";
import type { SupabaseClient } from "@supabase/supabase-js";

interface CompanyRow {
  id: string;
  slug: string;
  name: string;
  website_url: string | null;
  logo_asset_key: string | null;
  industry: string | null;
  company_sources: Array<{
    last_success_at: string | null;
    last_failure_at: string | null;
  }>;
}

interface PostingCountRow {
  company_id: string;
  open_count: number | string | null;
}

interface PostingRow {
  id: string;
  role_name: string;
  posting_url: string;
  season: string;
  location: string | null;
  date_posted: string | null;
  date_posted_source: PostedDateSource | null;
  date_posted_confidence: PostedDateConfidence | null;
  first_seen_at: string;
}

function mapPostingRow(row: PostingRow): ScrapedPostingRow | null {
  const normalizedLocation = row.location?.trim()
    ? normalizeScrapedLocationField(row.location.trim())
    : null;
  if (row.location?.trim() && !normalizedLocation) {
    return null;
  }

  const seasonValue = row.season.trim();
  if (!(FEED_SEASONS as readonly string[]).includes(seasonValue)) {
    return null;
  }
  const season = seasonValue as FeedSeason;
  const dateFields = {
    date_posted: row.date_posted,
    date_posted_source: row.date_posted_source ?? "unknown",
    date_posted_confidence: row.date_posted_confidence ?? "unknown",
    first_seen_at: row.first_seen_at,
  };
  const postedDisplay = resolvePostedDisplay(dateFields);
  const displayIso =
    postedDisplay.kind === "posted"
      ? row.date_posted
      : postedDisplay.kind === "added"
        ? row.first_seen_at
        : null;

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

function buildOpenCountMap(rows: PostingCountRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.company_id, Number(row.open_count ?? 0));
  }
  return counts;
}

export async function loadDiscoverCompanies(
  supabase: SupabaseClient,
  industryCatalog: DiscoverIndustryCatalogItem[],
): Promise<DiscoverCompanyCard[]> {
  const [companiesRes, countsRes] = await Promise.all([
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
          last_success_at,
          last_failure_at
        )
      `,
      )
      .eq("is_active", true)
      .eq("company_sources.enabled", true)
      .order("name", { ascending: true }),
    supabase.rpc("discover_company_open_counts"),
  ]);

  if (companiesRes.error) {
    throw companiesRes.error;
  }
  if (countsRes.error) {
    throw countsRes.error;
  }

  const labelByIndustry = new Map(industryCatalog.map((item) => [item.slug, item.label]));
  const openCounts = buildOpenCountMap((countsRes.data ?? []) as PostingCountRow[]);

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
      lastSuccessAt: source?.last_success_at ?? null,
      lastFailureAt: source?.last_failure_at ?? null,
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
    .select(
      "id, role_name, posting_url, season, location, date_posted, date_posted_source, date_posted_confidence, first_seen_at",
    )
    .eq("company_id", companyId)
    .eq("status", "open")
    .order("date_posted", { ascending: false, nullsFirst: false })
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
