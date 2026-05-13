import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsPage } from "@/components/settings-page";
import { resolveAccentColor } from "@/lib/config/accent";
import { resolveDiscoverCutoffDate } from "@/lib/config/discover";
import { assertSupabaseOk } from "@/lib/supabase/errors";

export const dynamic = "force-dynamic";

type PreferencesRow = {
  discover_cutoff_date?: string | null;
  accent_color?: string | null;
};

function isMissingAccentColumnError(error: { code?: string; message?: string } | null): boolean {
  return Boolean(
    error &&
      error.code === "42703" &&
      error.message?.toLowerCase().includes("accent_color"),
  );
}

export default async function Settings() {
  const supabase = await createClient();
  const userResult = await supabase.auth.getUser();

  const { data } = userResult;
  if (!data.user) redirect("/");

  let preferencesRes = await supabase
    .from("user_preferences")
    .select("discover_cutoff_date, accent_color")
    .maybeSingle<PreferencesRow>();

  if (isMissingAccentColumnError(preferencesRes.error)) {
    preferencesRes = await supabase
      .from("user_preferences")
      .select("discover_cutoff_date")
      .maybeSingle<PreferencesRow>();
  }

  assertSupabaseOk(preferencesRes.error, "Load preferences");

  const cutoff = resolveDiscoverCutoffDate(preferencesRes.data?.discover_cutoff_date);
  const accentColor = resolveAccentColor(preferencesRes.data?.accent_color);

  return (
    <SettingsPage
      userEmail={data.user.email ?? null}
      discoverCutoffDate={cutoff.cutoffDate}
      accentColor={accentColor}
      oldestAllowedDiscoverCutoffDate={cutoff.oldestAllowedDate}
      latestAllowedDiscoverCutoffDate={cutoff.today}
    />
  );
}
