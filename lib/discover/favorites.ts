import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadDiscoverCompanyFavoriteIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("discover_company_favorites")
    .select("company_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => row.company_id as string);
}

export async function loadDiscoverCompanyFavoriteSlugs(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("discover_company_favorites")
    .select("companies!inner(slug)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row) => {
      const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
      return (company as { slug?: string } | null)?.slug ?? null;
    })
    .filter((slug): slug is string => Boolean(slug));
}
