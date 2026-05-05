"use server";

import { updateTag } from "next/cache";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { clearFeedMemo } from "@/lib/feed/source";
import { consumeAuthenticatedRateLimit } from "@/lib/rate-limit";

const MAX_POSTING_ID_LENGTH = 300;

function cleanPostingId(postingId: unknown): string | null {
  if (typeof postingId !== "string") return null;
  const value = postingId.trim();
  if (!value || value.length > MAX_POSTING_ID_LENGTH) return null;
  return value;
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

export async function dismissPosting(postingId: string) {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };
  const cleanedPostingId = cleanPostingId(postingId);
  if (!cleanedPostingId) return { error: "Invalid posting id." };

  const { error } = await supabase
    .from("feed_interactions")
    .upsert(
      { user_id: user.id, posting_id: cleanedPostingId, kind: "dismissed" },
      { onConflict: "user_id,posting_id,kind" },
    );
  if (error) return { error: error.message };

  return { ok: true };
}

export async function undismissPosting(postingId: string) {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };
  const cleanedPostingId = cleanPostingId(postingId);
  if (!cleanedPostingId) return { error: "Invalid posting id." };

  const { error } = await supabase
    .from("feed_interactions")
    .delete()
    .eq("user_id", user.id)
    .eq("posting_id", cleanedPostingId)
    .eq("kind", "dismissed");
  if (error) return { error: error.message };

  return { ok: true };
}

export async function savePosting(postingId: string) {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };
  const cleanedPostingId = cleanPostingId(postingId);
  if (!cleanedPostingId) return { error: "Invalid posting id." };

  const { error } = await supabase
    .from("feed_interactions")
    .upsert(
      { user_id: user.id, posting_id: cleanedPostingId, kind: "saved" },
      { onConflict: "user_id,posting_id,kind" },
    );
  if (error) return { error: error.message };

  return { ok: true };
}

export async function unsavePosting(postingId: string) {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };
  const cleanedPostingId = cleanPostingId(postingId);
  if (!cleanedPostingId) return { error: "Invalid posting id." };

  const { error } = await supabase
    .from("feed_interactions")
    .delete()
    .eq("user_id", user.id)
    .eq("posting_id", cleanedPostingId)
    .eq("kind", "saved");
  if (error) return { error: error.message };

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
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };
  const rateLimit = await consumeAuthenticatedRateLimit(supabase, "feed:refresh", 10, 600);
  if (!rateLimit.ok) return { error: rateLimit.error };

  // Bust both caches: Next's fetch-cache (tagged sources like vanshb03 and
  // Northwestern) and our in-process memo (SimplifyJobs, whose raw payload
  // exceeds Next's 2MB limit).
  updateTag("discover-feed");
  clearFeedMemo();
  return { ok: true };
}
