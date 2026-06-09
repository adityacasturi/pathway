import {
  isProductScopeActive,
  scrapedPostingRowMatchesProductScope,
} from "@/lib/feed/product-scope";
import type { LocationPlaceJson } from "@/lib/geo/types";
import type { SupabaseClient } from "@supabase/supabase-js";

interface PostingCountRow {
  company_id: string;
  open_count: number | string | null;
}

interface ScopedPostingRow {
  company_id: string;
  countries: string[] | null;
  location: string | null;
  location_places: LocationPlaceJson[] | null;
}

async function loadEligibleCompanyIds(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("id, company_sources!inner ( enabled )")
    .eq("is_active", true)
    .eq("company_sources.enabled", true);

  if (error) {
    throw error;
  }

  return ((data ?? []) as { id: string }[]).map((row) => row.id);
}

function buildOpenCountMap(rows: PostingCountRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.company_id, Number(row.open_count ?? 0));
  }
  return counts;
}

async function loadProductScopedOpenCounts(supabase: SupabaseClient): Promise<Map<string, number>> {
  const companyIds = await loadEligibleCompanyIds(supabase);
  if (companyIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("scraped_postings")
    .select("company_id, countries, location, location_places")
    .eq("status", "open")
    .in("company_id", companyIds);

  if (error) {
    throw error;
  }

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as ScopedPostingRow[]) {
    if (!scrapedPostingRowMatchesProductScope(row)) {
      continue;
    }
    counts.set(row.company_id, (counts.get(row.company_id) ?? 0) + 1);
  }
  return counts;
}

export async function loadDiscoverCompanyOpenCounts(
  supabase: SupabaseClient,
): Promise<Map<string, number>> {
  if (!isProductScopeActive()) {
    const { data, error } = await supabase.rpc("discover_company_open_counts");
    if (error) {
      throw error;
    }
    return buildOpenCountMap((data ?? []) as PostingCountRow[]);
  }

  return loadProductScopedOpenCounts(supabase);
}
