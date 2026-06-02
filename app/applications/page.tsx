import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Dashboard } from "@/components/dashboard";
import { Application } from "@/types/application";
import { normalizeApplicationState } from "@/lib/config/application-state";
import {
  companyLogoAssetByNameFromLookups,
  companySlugByNameFromLookups,
  companyWebsiteByNameFromLookups,
  loadCompanyWebsiteLookups,
} from "@/lib/logo/company-website-lookup";
import { loadUserViewPreferences } from "@/lib/user-preferences/load-view-preferences";
import { assertSupabaseOk } from "@/lib/supabase/errors";

export default async function ApplicationsPage() {
  const supabase = await createClient();

  // Kick off auth verification and the applications fetch in parallel. RLS
  // scopes the query to the authenticated user automatically, so we don't
  // need user.id before issuing it. Saves one Supabase round-trip (~100ms)
  // on every page load.
  const [userResult, appsResult, websiteLookups, viewPrefs] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("applications")
      .select("*, application_events(*)")
      .order("created_at", { ascending: false }),
    loadCompanyWebsiteLookups(supabase),
    loadUserViewPreferences(supabase),
  ]);

  if (!userResult.data.user) redirect("/");

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
