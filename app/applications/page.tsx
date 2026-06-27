import { redirect } from "next/navigation";
import { pageMetadata } from "@/lib/metadata/page";

export const metadata = pageMetadata("Applications", "Track internship applications and pipeline status.");
import { ApplicationsPage as Dashboard } from "@/components/applications/applications-page";
import { Application } from "@/types/application";
import { normalizeApplicationState } from "@/lib/config/application-state";
import {
  companyLogoAssetByNameFromLookups,
  companySlugByNameFromLookups,
  companyWebsiteByNameFromLookups,
} from "@/lib/logo/company-website-lookup";
import { getCachedCompanyWebsiteLookups } from "@/lib/cache/catalog";
import { loadUserViewPreferences } from "@/lib/user-preferences/load-view-preferences";
import { assertSupabaseOk } from "@/lib/supabase/errors";
import { getAuthenticatedUser } from "@/lib/supabase/auth";

export default async function ApplicationsPage() {
  const { supabase, user } = await getAuthenticatedUser();

  if (!user) redirect("/login?next=/applications");
  const userId = user.id;

  const [appsResult, websiteLookups, viewPrefs] = await Promise.all([
    supabase
      .from("applications")
      .select("*, application_events(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    getCachedCompanyWebsiteLookups(),
    loadUserViewPreferences(supabase, userId),
  ]);

  assertSupabaseOk(appsResult.error, "Load applications");

  const applications: Application[] = (appsResult.data ?? []).map((row) =>
    normalizeApplicationState({
      ...row,
      events: row.application_events ?? [],
      last_activity_date: row.created_at.slice(0, 10),
    }),
  );

  return (
    <Dashboard
      applications={applications}
      companyWebsiteByName={companyWebsiteByNameFromLookups(websiteLookups)}
      companySlugByName={companySlugByNameFromLookups(websiteLookups)}
      companyLogoAssetByName={companyLogoAssetByNameFromLookups(websiteLookups)}
      initialViewPrefs={viewPrefs.applications}
    />
  );
}
