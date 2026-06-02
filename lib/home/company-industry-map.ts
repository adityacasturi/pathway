import { loadDiscoverIndustryCatalog } from "../discover/catalog.ts";
import type { CompanyIndustryInfo } from "./briefing.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

interface CompanyIndustryRow {
  slug: string;
  industry: string | null;
}

export async function loadCompanyIndustryBySlug(
  supabase: SupabaseClient,
): Promise<Map<string, CompanyIndustryInfo>> {
  const [catalog, companiesRes] = await Promise.all([
    loadDiscoverIndustryCatalog(supabase),
    supabase.from("companies").select("slug, industry").eq("is_active", true),
  ]);

  if (companiesRes.error) {
    throw companiesRes.error;
  }

  const labelBySlug = new Map(catalog.map((item) => [item.slug, item.label]));
  const map = new Map<string, CompanyIndustryInfo>();

  for (const row of (companiesRes.data ?? []) as CompanyIndustryRow[]) {
    if (!row.slug || !row.industry) continue;
    map.set(row.slug, {
      industrySlug: row.industry,
      industryLabel: labelBySlug.get(row.industry) ?? row.industry,
    });
  }

  return map;
}
