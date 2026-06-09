import type { SupabaseClient } from "@supabase/supabase-js";
import type { CuratedAlertSector } from "@/lib/alerts/curated-sectors";

interface SectorRow {
  slug: string;
  label: string;
  description: string;
  sort_order: number;
}

interface MemberRow {
  sector_slug: string;
  company_slug: string;
}

/** Alert bundles with company membership from Postgres. */
export async function loadCuratedAlertSectors(
  supabase: SupabaseClient,
): Promise<CuratedAlertSector[]> {
  const [sectorsRes, membersRes] = await Promise.all([
    supabase
      .from("alert_curated_sectors")
      .select("slug, label, description, sort_order")
      .order("sort_order", { ascending: true }),
    supabase.from("alert_curated_sector_companies").select("sector_slug, company_slug"),
  ]);

  if (sectorsRes.error) throw sectorsRes.error;
  if (membersRes.error) throw membersRes.error;

  const companySlugsBySector = new Map<string, string[]>();
  for (const row of (membersRes.data ?? []) as MemberRow[]) {
    const list = companySlugsBySector.get(row.sector_slug) ?? [];
    list.push(row.company_slug);
    companySlugsBySector.set(row.sector_slug, list);
  }

  return ((sectorsRes.data ?? []) as SectorRow[]).map((sector) => ({
    slug: sector.slug,
    label: sector.label,
    description: sector.description,
    companySlugs: companySlugsBySector.get(sector.slug) ?? [],
  }));
}

/** For alert matching in cron — sector slug → set of company slugs. */
export async function loadCuratedSectorCompanyMap(
  supabase: SupabaseClient,
): Promise<Map<string, Set<string>>> {
  const { data, error } = await supabase
    .from("alert_curated_sector_companies")
    .select("sector_slug, company_slug");

  if (error) throw error;

  const map = new Map<string, Set<string>>();
  for (const row of (data ?? []) as MemberRow[]) {
    let set = map.get(row.sector_slug);
    if (!set) {
      set = new Set();
      map.set(row.sector_slug, set);
    }
    set.add(row.company_slug);
  }
  return map;
}
