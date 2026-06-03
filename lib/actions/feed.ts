"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { formatSupabaseMutationError } from "@/lib/supabase/errors";
import { limitServerActionByIp } from "@/lib/rate-limit";

const MAX_POSTING_ID_LENGTH = 300;
const INTERACTION_RATE_LIMIT_REQUESTS = 120;
const INTERACTION_RATE_LIMIT_WINDOW_MS = 60_000;

async function limitFeedInteractionWrite() {
  return limitServerActionByIp(
    "feed-interactions:write",
    INTERACTION_RATE_LIMIT_REQUESTS,
    INTERACTION_RATE_LIMIT_WINDOW_MS,
  );
}

function cleanPostingId(postingId: unknown): string | null {
  if (typeof postingId !== "string") return null;
  const value = postingId.trim();
  if (!value || value.length > MAX_POSTING_ID_LENGTH) return null;
  return value;
}

function cleanPostingIds(postingIds: unknown): string[] {
  const source = Array.isArray(postingIds) ? postingIds : [postingIds];
  const ids = new Set<string>();
  for (const postingId of source) {
    const cleaned = cleanPostingId(postingId);
    if (cleaned) ids.add(cleaned);
  }
  return Array.from(ids);
}

/**
 * Persisted feed interactions, keyed by posting id (URL hash or legacy upstream id).
 *
 * Intentionally no revalidatePath here. The client tracks dismissed/saved state
 * optimistically, so revalidating Live on every toggle would re-query all open
 * scraped postings with no user-visible benefit. Fresh state is picked up on
 * navigation or Refresh.
 */

export async function dismissPosting(postingIds: string | string[]) {
  const rateLimit = await limitFeedInteractionWrite();
  if (!rateLimit.ok) return { error: rateLimit.error };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };
  const cleanedPostingIds = cleanPostingIds(postingIds);
  const primaryPostingId = cleanedPostingIds[0];
  if (!primaryPostingId) return { error: "Invalid posting id." };
  const { error } = await supabase
    .from("feed_interactions")
    .upsert(
      { user_id: user.id, posting_id: primaryPostingId, kind: "dismissed" },
      { onConflict: "user_id,posting_id,kind" },
    );
  if (error) return { error: formatSupabaseMutationError(error, "Unable to dismiss posting.") };

  return { ok: true };
}

export async function undismissPosting(postingIds: string | string[]) {
  const rateLimit = await limitFeedInteractionWrite();
  if (!rateLimit.ok) return { error: rateLimit.error };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };
  const cleanedPostingIds = cleanPostingIds(postingIds);
  if (cleanedPostingIds.length === 0) return { error: "Invalid posting id." };

  const { error } = await supabase
    .from("feed_interactions")
    .delete()
    .eq("user_id", user.id)
    .in("posting_id", cleanedPostingIds)
    .eq("kind", "dismissed");
  if (error) return { error: formatSupabaseMutationError(error, "Unable to restore posting.") };

  return { ok: true };
}

export async function savePosting(postingIds: string | string[]) {
  const rateLimit = await limitFeedInteractionWrite();
  if (!rateLimit.ok) return { error: rateLimit.error };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };
  const cleanedPostingIds = cleanPostingIds(postingIds);
  const primaryPostingId = cleanedPostingIds[0];
  if (!primaryPostingId) return { error: "Invalid posting id." };

  const { error } = await supabase
    .from("feed_interactions")
    .upsert(
      { user_id: user.id, posting_id: primaryPostingId, kind: "saved" },
      { onConflict: "user_id,posting_id,kind" },
    );
  if (error) return { error: formatSupabaseMutationError(error, "Unable to save posting.") };

  return { ok: true };
}

export async function unsavePosting(postingIds: string | string[]) {
  const rateLimit = await limitFeedInteractionWrite();
  if (!rateLimit.ok) return { error: rateLimit.error };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };
  const cleanedPostingIds = cleanPostingIds(postingIds);
  if (cleanedPostingIds.length === 0) return { error: "Invalid posting id." };

  const { error } = await supabase
    .from("feed_interactions")
    .delete()
    .eq("user_id", user.id)
    .in("posting_id", cleanedPostingIds)
    .eq("kind", "saved");
  if (error) return { error: formatSupabaseMutationError(error, "Unable to unsave posting.") };

  return { ok: true };
}

/**
 * Re-read scraped postings from Supabase for Live and Home. Does not run scrape
 * jobs — ingestion stays on the 30-minute cron (`/api/cron/scrape-postings`).
 * Pair with `router.refresh()` on the client.
 */
export async function refreshFeed() {
  const rateLimit = await limitServerActionByIp("feed:refresh", 10, 600_000);
  if (!rateLimit.ok) return { error: rateLimit.error };

  const { user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  revalidatePath("/openings");
  revalidatePath("/home");
  return { ok: true };
}
