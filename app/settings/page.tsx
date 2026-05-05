import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsPage } from "@/components/settings-page";
import { resolveDiscoverCutoffDate } from "@/lib/config/discover";
import { assertSupabaseOk } from "@/lib/supabase/errors";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const supabase = await createClient();
  const [userResult, preferencesRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("user_preferences").select("discover_cutoff_date").maybeSingle(),
  ]);

  const { data } = userResult;
  if (!data.user) redirect("/login");
  assertSupabaseOk(preferencesRes.error, "Load preferences");

  const cutoff = resolveDiscoverCutoffDate(preferencesRes.data?.discover_cutoff_date);

  return (
    <SettingsPage
      userEmail={data.user.email ?? null}
      discoverCutoffDate={cutoff.cutoffDate}
      oldestAllowedDiscoverCutoffDate={cutoff.oldestAllowedDate}
      latestAllowedDiscoverCutoffDate={cutoff.today}
    />
  );
}
