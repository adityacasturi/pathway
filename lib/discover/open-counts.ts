import type { SupabaseClient } from "@supabase/supabase-js";

interface PostingCountRow {
  company_id: string;
  open_count: number | string | null;
}

function buildOpenCountMap(rows: PostingCountRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.company_id, Number(row.open_count ?? 0));
  }
  return counts;
}

export async function loadDiscoverCompanyOpenCounts(
  supabase: SupabaseClient,
): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc("discover_company_open_counts");
  if (error) {
    throw error;
  }
  return buildOpenCountMap((data ?? []) as PostingCountRow[]);
}
