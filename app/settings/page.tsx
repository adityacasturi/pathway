import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsPage } from "@/components/settings-page";
import { resolveAccentColor } from "@/lib/config/accent";
import { isMissingPreferenceColumnError } from "@/lib/config/user-preferences";
import { assertSupabaseOk } from "@/lib/supabase/errors";

export const dynamic = "force-dynamic";

type PreferencesRow = {
  accent_color?: string | null;
  quick_track_enabled?: boolean | null;
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
    .select("accent_color, quick_track_enabled")
    .maybeSingle<PreferencesRow>();

  if (isMissingPreferenceColumnError(preferencesRes.error, "quick_track_enabled")) {
    preferencesRes = await supabase
      .from("user_preferences")
      .select("accent_color")
      .maybeSingle<PreferencesRow>();
  }

  if (isMissingAccentColumnError(preferencesRes.error)) {
    preferencesRes = await supabase
      .from("user_preferences")
      .select("quick_track_enabled")
      .maybeSingle<PreferencesRow>();
  }

  assertSupabaseOk(preferencesRes.error, "Load preferences");

  const accentColor = resolveAccentColor(preferencesRes.data?.accent_color);

  return (
    <SettingsPage
      userEmail={data.user.email ?? null}
      accentColor={accentColor}
      quickTrackEnabled={preferencesRes.data?.quick_track_enabled ?? false}
    />
  );
}
