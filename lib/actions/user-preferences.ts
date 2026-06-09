"use server";

import { revalidatePath } from "next/cache";
import {
  parseApplicationsViewPreferencesPatch,
  parseFeedViewPreferencesPatch,
  serializeSelectedSeasons,
  type ApplicationsViewPreferencesPatch,
  type FeedViewPreferencesPatch,
} from "@/lib/user-preferences/view-preferences";
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

export async function updateFeedViewPreferences(patch: FeedViewPreferencesPatch) {
  const rateLimit = await limitPrefsWrite();
  if (!rateLimit.ok) return { error: rateLimit.error };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  const parsed = parseFeedViewPreferencesPatch(patch);
  if ("error" in parsed) return { error: parsed.error };

  const row: Record<string, unknown> = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };

  if (parsed.patch.lastSeenAtIso !== undefined) {
    row.live_last_seen_at = parsed.patch.lastSeenAtIso;
  }
  if (parsed.patch.hideApplied !== undefined) {
    row.live_hide_applied = parsed.patch.hideApplied;
  }
  if (parsed.patch.selectedSeasons !== undefined) {
    row.live_season_filter = serializeSelectedSeasons(parsed.patch.selectedSeasons);
  }

  const { error } = await supabase.from("user_preferences").upsert(row, { onConflict: "user_id" });

  if (isMissingPreferenceColumnError(error, "live_last_seen_at")) {
    return {
      error: "Live feed preferences are unavailable until the latest database migration is applied.",
    };
  }
  if (error) {
    return { error: formatSupabaseMutationError(error, "Unable to save feed preferences.") };
  }

  revalidatePath("/openings");
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateApplicationsViewPreferences(
  patch: ApplicationsViewPreferencesPatch,
) {
  const rateLimit = await limitPrefsWrite();
  if (!rateLimit.ok) return { error: rateLimit.error };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  const parsed = parseApplicationsViewPreferencesPatch(patch);
  if ("error" in parsed) return { error: parsed.error };

  const row: Record<string, unknown> = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };

  if (parsed.patch.hideRejected !== undefined) {
    row.hide_rejected = parsed.patch.hideRejected;
  }
  if (parsed.patch.hideArchived !== undefined) {
    row.hide_archived = parsed.patch.hideArchived;
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
  revalidatePath("/settings");
  return { ok: true };
}
