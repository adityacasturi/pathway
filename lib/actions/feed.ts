"use server";

import { updateTag } from "next/cache";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { formatSupabaseMutationError } from "@/lib/supabase/errors";
import { clearFeedMemo } from "@/lib/feed/source";
import { limitServerActionByIp } from "@/lib/rate-limit";

const MAX_POSTING_ID_LENGTH = 300;

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
 * Persisted feed interactions, keyed by upstream posting id.
 *
 * Intentionally no revalidatePath here. The client tracks dismissed state
 * optimistically (see DiscoverFeed / Home dismissedSet), so revalidating the
 * whole route on every toggle would just re-fetch the feed (including a
 * 20MB SimplifyJobs payload) with no user-visible benefit. Fresh state is
 * picked up on the next navigation / refresh click.
 */

export async function dismissPosting(postingIds: string | string[]) {
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
 * Force-bust the upstream feed cache. Under normal operation fetchFeed()'s
 * underlying fetches are ISR-cached for FEED_REVALIDATE_SECONDS via the
 * "discover-feed" tag; this server action invalidates that tag so the next
 * render pulls fresh data from each upstream source. Pair with a
 * router.refresh() on the client to trigger that render immediately.
 *
 * Uses updateTag (Next 16) rather than revalidateTag so we get
 * read-your-own-writes semantics inside this server action.
 */
export async function refreshFeed() {
  const rateLimit = await limitServerActionByIp("feed:refresh", 10, 600_000);
  if (!rateLimit.ok) return { error: rateLimit.error };

  const { user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  // Bust both caches: Next's fetch-cache (vanshb03) and our in-process memo
  // (SimplifyJobs, whose raw payload exceeds Next's 2MB limit).
  updateTag("discover-feed");
  clearFeedMemo();
  return { ok: true };
}
