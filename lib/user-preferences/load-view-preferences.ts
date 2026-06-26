import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applicationsViewPreferencesFromRow,
  feedViewPreferencesFromRow,
  type ApplicationsViewPreferences,
  type FeedViewPreferences,
} from "@/lib/user-preferences/view-preferences";

const VIEW_PREFERENCE_COLUMNS =
  "live_hide_applied, live_season_filter, hide_rejected, hide_archived";

export interface UserViewPreferences {
  feed: FeedViewPreferences;
  applications: ApplicationsViewPreferences;
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

  if (error) throw error;

  return {
    feed: feedViewPreferencesFromRow(data),
    applications: applicationsViewPreferencesFromRow(data),
  };
}
