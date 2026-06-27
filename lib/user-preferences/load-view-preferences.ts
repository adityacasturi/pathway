import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingPreferenceColumnError } from "@/lib/config/user-preferences";
import { assertSupabaseOk } from "@/lib/supabase/errors";
import {
  applicationsViewPreferencesFromRow,
  feedViewPreferencesFromRow,
  type ApplicationsViewPreferences,
  type FeedViewPreferences,
} from "@/lib/user-preferences/view-preferences";

const VIEW_PREFERENCE_COLUMNS =
  "live_hide_applied, live_season_filter, hide_rejected, hide_archived, quick_track_enabled";

export interface UserViewPreferences {
  feed: FeedViewPreferences;
  applications: ApplicationsViewPreferences;
  quickTrackEnabled: boolean;
}

export async function loadUserViewPreferences(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserViewPreferences> {
  const { data, error } = await supabase
    .from("user_preferences")
    .select(VIEW_PREFERENCE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  if (!isMissingPreferenceColumnError(error, "quick_track_enabled")) {
    assertSupabaseOk(error, "Load preferences");
  }

  const quickTrackMissing = isMissingPreferenceColumnError(error, "quick_track_enabled");

  return {
    feed: feedViewPreferencesFromRow(data),
    applications: applicationsViewPreferencesFromRow(data),
    quickTrackEnabled: quickTrackMissing ? false : Boolean(data?.quick_track_enabled),
  };
}
