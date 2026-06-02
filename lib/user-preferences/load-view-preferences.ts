import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applicationsViewPreferencesFromRow,
  feedViewPreferencesFromRow,
  type ApplicationsViewPreferences,
  type FeedViewPreferences,
} from "@/lib/user-preferences/view-preferences";

const VIEW_PREFERENCE_COLUMNS =
  "live_last_seen_at, live_show_dismissed, live_hide_applied, live_season_filter, hide_rejected, hide_archived";

export interface UserViewPreferences {
  feed: FeedViewPreferences;
  applications: ApplicationsViewPreferences;
}

export async function loadUserViewPreferences(
  supabase: SupabaseClient,
): Promise<UserViewPreferences> {
  const { data, error } = await supabase
    .from("user_preferences")
    .select(VIEW_PREFERENCE_COLUMNS)
    .maybeSingle();

  if (error) throw error;

  return {
    feed: feedViewPreferencesFromRow(data),
    applications: applicationsViewPreferencesFromRow(data),
  };
}
