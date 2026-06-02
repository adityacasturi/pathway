import type { SupabaseClient } from "@supabase/supabase-js";

export interface DiscoverIndustryCatalogItem {
  slug: string;
  label: string;
  description: string;
  sortOrder: number;
}

interface DiscoverIndustryRow {
  slug: string;
  label: string;
  description: string;
  sort_order: number;
}

export async function loadDiscoverIndustryCatalog(
  supabase: SupabaseClient,
): Promise<DiscoverIndustryCatalogItem[]> {
  const { data, error } = await supabase
    .from("discover_industries")
    .select("slug, label, description, sort_order")
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as DiscoverIndustryRow[]).map((row) => ({
    slug: row.slug,
    label: row.label,
    description: row.description,
    sortOrder: row.sort_order,
  }));
}
