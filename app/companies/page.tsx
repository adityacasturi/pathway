import { redirect } from "next/navigation";
import { pageMetadata } from "@/lib/metadata/page";

export const metadata = pageMetadata("Companies", "Explore companies and their open internship roles.");
import { CompaniesPage as DiscoverCompanies } from "@/components/companies/companies-page";
import {
  getCachedDiscoverCompanies,
  getCachedDiscoverIndustryCatalog,
} from "@/lib/cache/catalog";
import { loadDiscoverCompanyFavoriteIds } from "@/lib/discover/favorites";
import { assertSupabaseOk } from "@/lib/supabase/errors";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { normalizeUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login?next=/companies");
  const userId = user.id;

  const [industryCatalog, companies, starredCompanyIds, interactionsRes, appsRes] =
    await Promise.all([
      getCachedDiscoverIndustryCatalog(),
      getCachedDiscoverCompanies(),
      loadDiscoverCompanyFavoriteIds(supabase, userId),
      supabase
        .from("feed_interactions")
        .select("posting_id")
        .eq("user_id", userId)
        .eq("kind", "dismissed"),
      supabase
        .from("applications")
        .select("posting_url")
        .eq("user_id", userId)
        .is("archived_at", null),
    ]);

  assertSupabaseOk(interactionsRes.error, "Load feed interactions");
  assertSupabaseOk(appsRes.error, "Load tracked applications");

  const dismissedIds = new Set<string>();
  for (const row of interactionsRes.data ?? []) {
    dismissedIds.add(row.posting_id);
  }

  const trackedUrls = new Set<string>();
  for (const row of appsRes.data ?? []) {
    const normalized = normalizeUrl(row.posting_url);
    if (normalized) trackedUrls.add(normalized);
  }

  return (
    <DiscoverCompanies
      companies={companies}
      industryCatalog={industryCatalog}
      initialStarredCompanyIds={starredCompanyIds}
      dismissedIds={Array.from(dismissedIds)}
      trackedUrls={Array.from(trackedUrls)}
    />
  );
}
