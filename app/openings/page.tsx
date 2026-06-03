import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchFeed } from "@/lib/feed/source";
import { normalizeUrl } from "@/lib/url";
import { LiveFeed } from "@/components/live-feed";
import { isMissingPreferenceColumnError } from "@/lib/config/user-preferences";
import { loadUserViewPreferences } from "@/lib/user-preferences/load-view-preferences";
import { assertSupabaseOk } from "@/lib/supabase/errors";

export const dynamic = "force-dynamic";

interface LivePageProps {
  searchParams: Promise<{
    q?: string | string[];
    saved?: string | string[];
  }>;
}

export default async function OpeningsPage({ searchParams }: LivePageProps) {
  const supabase = await createClient();
  const params = await searchParams;
  const initialQuery = typeof params.q === "string" ? params.q : "";
  const initialSavedOnly = params.saved !== undefined;

  const [userResult, postings, interactionsRes, appsRes, preferencesRes, viewPrefs] =
    await Promise.all([
      supabase.auth.getUser(),
      fetchFeed(),
      supabase.from("feed_interactions").select("posting_id, kind"),
      supabase.from("applications").select("posting_url").is("archived_at", null),
      supabase.from("user_preferences").select("quick_track_enabled").maybeSingle(),
      loadUserViewPreferences(supabase),
    ]);

  if (!userResult.data.user) redirect("/login?next=/openings");

  assertSupabaseOk(interactionsRes.error, "Load feed interactions");
  assertSupabaseOk(appsRes.error, "Load tracked applications");
  if (!isMissingPreferenceColumnError(preferencesRes.error, "quick_track_enabled")) {
    assertSupabaseOk(preferencesRes.error, "Load preferences");
  }

  const dismissedIds = new Set<string>();
  const savedIds = new Set<string>();
  for (const row of interactionsRes.data ?? []) {
    if (row.kind === "dismissed") dismissedIds.add(row.posting_id);
    if (row.kind === "saved") savedIds.add(row.posting_id);
  }

  const trackedUrls = new Set<string>();
  for (const row of appsRes.data ?? []) {
    const normalized = normalizeUrl(row.posting_url);
    if (normalized) trackedUrls.add(normalized);
  }

  return (
    <LiveFeed
      postings={postings}
      dismissedIds={Array.from(dismissedIds)}
      savedIds={Array.from(savedIds)}
      trackedUrls={Array.from(trackedUrls)}
      initialQuery={initialQuery}
      initialSavedOnly={initialSavedOnly}
      quickTrackEnabled={preferencesRes.data?.quick_track_enabled ?? false}
      initialFeedPrefs={viewPrefs.feed}
    />
  );
}
