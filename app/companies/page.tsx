import { redirect } from "next/navigation";
import { DiscoverCompanies } from "@/components/discover-companies";
import { loadDiscoverIndustryCatalog } from "@/lib/discover/catalog";
import { loadDiscoverCompanies } from "@/lib/discover/companies";
import { loadDiscoverCompanyFavoriteIds } from "@/lib/discover/favorites";
import { isMissingPreferenceColumnError } from "@/lib/config/user-preferences";
import { assertSupabaseOk } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";
import { normalizeUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login?next=/companies");

  const industryCatalog = await loadDiscoverIndustryCatalog(supabase);
  const [companies, starredCompanyIds, interactionsRes, appsRes, preferencesRes] =
    await Promise.all([
      loadDiscoverCompanies(supabase, industryCatalog),
      loadDiscoverCompanyFavoriteIds(supabase, userData.user.id),
      supabase.from("feed_interactions").select("posting_id, kind"),
      supabase.from("applications").select("posting_url").is("archived_at", null),
      supabase.from("user_preferences").select("quick_track_enabled").maybeSingle(),
    ]);

  assertSupabaseOk(interactionsRes.error, "Load feed interactions");
  assertSupabaseOk(appsRes.error, "Load tracked applications");
  if (!isMissingPreferenceColumnError(preferencesRes.error, "quick_track_enabled")) {
    assertSupabaseOk(preferencesRes.error, "Load preferences");
  }

  const savedIds = new Set<string>();
  for (const row of interactionsRes.data ?? []) {
    if (row.kind === "saved") savedIds.add(row.posting_id);
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
      savedIds={Array.from(savedIds)}
      trackedUrls={Array.from(trackedUrls)}
      quickTrackEnabled={preferencesRes.data?.quick_track_enabled ?? false}
    />
  );
}
