import { resolveAccentColor, type AccentColor } from "@/lib/config/accent";
import { assertSupabaseOk } from "@/lib/supabase/errors";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AppearancePreferences = {
  accentColor: AccentColor;
};

type PreferencesRow = {
  accent_color?: string | null;
};

function isMissingColumnError(
  error: { code?: string; message?: string } | null,
  column: string,
): boolean {
  return Boolean(
    error &&
      error.code === "42703" &&
      error.message?.toLowerCase().includes(column.toLowerCase()),
  );
}

export async function loadAppearancePreferences(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppearancePreferences> {
  const preferencesRes = await supabase
    .from("user_preferences")
    .select("accent_color")
    .eq("user_id", userId)
    .maybeSingle<PreferencesRow>();

  if (!isMissingColumnError(preferencesRes.error, "accent_color")) {
    assertSupabaseOk(preferencesRes.error, "Load preferences");
  }

  const accentMissing = isMissingColumnError(preferencesRes.error, "accent_color");

  return {
    accentColor: resolveAccentColor(accentMissing ? null : preferencesRes.data?.accent_color),
  };
}
