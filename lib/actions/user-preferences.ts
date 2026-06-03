"use server";

import { revalidatePath } from "next/cache";
import type { SeasonFilter } from "@/lib/config/season-filter";
import { parseSeasonFilter } from "@/lib/user-preferences/view-preferences";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { limitServerActionByIp } from "@/lib/rate-limit";
import { isMissingPreferenceColumnError } from "@/lib/config/user-preferences";
import { formatSupabaseMutationError } from "@/lib/supabase/errors";

const PREFS_RATE_LIMIT_REQUESTS = 60;
const PREFS_RATE_LIMIT_WINDOW_MS = 60_000;

async function limitPrefsWrite() {
  return limitServerActionByIp(
    "user-preferences:write",
    PREFS_RATE_LIMIT_REQUESTS,
    PREFS_RATE_LIMIT_WINDOW_MS,
  );
}

export type FeedViewPreferencesPatch = {
  lastSeenUnix?: number;
  showDismissed?: boolean;
  hideApplied?: boolean;
  seasonFilter?: SeasonFilter;
};

export type ApplicationsViewPreferencesPatch = {
  hideRejected?: boolean;
  hideArchived?: boolean;
};

export async function updateFeedViewPreferences(patch: FeedViewPreferencesPatch) {
  const rateLimit = await limitPrefsWrite();
  if (!rateLimit.ok) return { error: rateLimit.error };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  const row: Record<string, unknown> = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };

  if (patch.lastSeenUnix !== undefined) {
    const unix = Math.max(0, Math.floor(patch.lastSeenUnix));
    row.live_last_seen_at = new Date(unix * 1000).toISOString();
  }
  if (patch.showDismissed !== undefined) {
    row.live_show_dismissed = patch.showDismissed;
  }
  if (patch.hideApplied !== undefined) {
    row.live_hide_applied = patch.hideApplied;
  }
  if (patch.seasonFilter !== undefined) {
    row.live_season_filter = parseSeasonFilter(patch.seasonFilter);
  }

  const { error } = await supabase.from("user_preferences").upsert(row, { onConflict: "user_id" });

  if (
    isMissingPreferenceColumnError(error, "live_last_seen_at") ||
    isMissingPreferenceColumnError(error, "live_show_dismissed")
  ) {
    return {
      error: "Live feed preferences are unavailable until the latest database migration is applied.",
    };
  }
  if (error) {
    return { error: formatSupabaseMutationError(error, "Unable to save feed preferences.") };
  }

  revalidatePath("/openings");
  return { ok: true };
}

export async function updateApplicationsViewPreferences(
  patch: ApplicationsViewPreferencesPatch,
) {
  const rateLimit = await limitPrefsWrite();
  if (!rateLimit.ok) return { error: rateLimit.error };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  const row: Record<string, unknown> = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };

  if (patch.hideRejected !== undefined) {
    row.hide_rejected = patch.hideRejected;
  }
  if (patch.hideArchived !== undefined) {
    row.hide_archived = patch.hideArchived;
  }

  const { error } = await supabase.from("user_preferences").upsert(row, { onConflict: "user_id" });

  if (isMissingPreferenceColumnError(error, "hide_rejected")) {
    return {
      error:
        "Application view preferences are unavailable until the latest database migration is applied.",
    };
  }
  if (error) {
    return {
      error: formatSupabaseMutationError(error, "Unable to save application preferences."),
    };
  }

  revalidatePath("/applications");
  return { ok: true };
}
