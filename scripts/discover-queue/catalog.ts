import { createAdminClient } from "../../lib/supabase/admin.ts";
import { loadDotEnvLocal } from "./env.ts";

export interface CatalogCheckResult {
  slug: string;
  inCatalog: boolean;
  companyId: string | null;
  enabledSourceCount: number;
  sourceTypes: string[];
}

export async function checkDiscoverCatalog(slug: string): Promise<CatalogCheckResult> {
  loadDotEnvLocal();
  const admin = createAdminClient();

  const { data: company, error } = await admin
    .from("companies")
    .select("id, slug, company_sources ( enabled, source_type )")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!company) {
    return {
      slug,
      inCatalog: false,
      companyId: null,
      enabledSourceCount: 0,
      sourceTypes: [],
    };
  }

  const sources = (company.company_sources ?? []) as { enabled: boolean; source_type: string }[];
  const enabled = sources.filter((row) => row.enabled);

  return {
    slug,
    inCatalog: enabled.length > 0,
    companyId: company.id as string,
    enabledSourceCount: enabled.length,
    sourceTypes: enabled.map((row) => row.source_type),
  };
}
