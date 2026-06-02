import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchFeed } from "@/lib/feed/source";
import { normalizeUrl } from "@/lib/url";
import { Home } from "@/components/home";
import { normalizeApplicationState } from "@/lib/config/application-state";
import { isMissingPreferenceColumnError } from "@/lib/config/user-preferences";
import { loadDiscoverCompanyFavoriteSlugs } from "@/lib/discover/favorites";
import {
  buildHomeBriefing,
  HOME_NEW_WINDOW_SECONDS,
} from "@/lib/home/briefing";
import { assertSupabaseOk } from "@/lib/supabase/errors";
import type { FeedPosting } from "@/lib/feed/source";
import type { Application } from "@/types/application";

export const dynamic = "force-dynamic";

function hasInteraction(ids: Set<string>, posting: FeedPosting): boolean {
  return posting.interactionIds.some((id) => ids.has(id));
}

function interactionDate(savedAtById: Map<string, string>, posting: FeedPosting): string {
  let latest = "";
  for (const id of posting.interactionIds) {
    const savedAt = savedAtById.get(id);
    if (savedAt && savedAt > latest) latest = savedAt;
  }
  return latest;
}

export default async function HomePage() {
  const supabase = await createClient();

  const [userResult, postings, appsRes, interactionsRes, preferencesRes] =
    await Promise.all([
      supabase.auth.getUser(),
      fetchFeed(),
      supabase
        .from("applications")
        .select("*, application_events(*)"),
      supabase.from("feed_interactions").select("posting_id, kind, created_at"),
      supabase.from("user_preferences").select("quick_track_enabled").maybeSingle(),
    ]);

  if (!userResult.data.user) redirect("/");

  const favoriteSlugs = await loadDiscoverCompanyFavoriteSlugs(
    supabase,
    userResult.data.user.id,
  );

  assertSupabaseOk(appsRes.error, "Load applications");
  assertSupabaseOk(interactionsRes.error, "Load feed interactions");
  if (!isMissingPreferenceColumnError(preferencesRes.error, "quick_track_enabled")) {
    assertSupabaseOk(preferencesRes.error, "Load preferences");
  }

  const activeApplications: Application[] = (appsRes.data ?? [])
    .filter((app) => !app.archived_at)
    .map((row) =>
      normalizeApplicationState({
        ...row,
        events: row.application_events ?? [],
        last_activity_date: row.created_at.slice(0, 10),
      }),
    );

  const dismissedIds: string[] = [];
  const savedRows: { posting_id: string; created_at: string }[] = [];
  for (const row of interactionsRes.data ?? []) {
    if (row.kind === "dismissed") dismissedIds.push(row.posting_id);
    if (row.kind === "saved") savedRows.push(row);
  }
  const dismissedSet = new Set(dismissedIds);
  const savedAtById = new Map(savedRows.map((row) => [row.posting_id, row.created_at]));
  const savedIdSet = new Set(savedAtById.keys());

  const trackedUrls = new Set<string>();
  for (const row of activeApplications) {
    const normalized = normalizeUrl(row.posting_url);
    if (normalized) trackedUrls.add(normalized);
  }

  // eslint-disable-next-line react-hooks/purity
  const nowUnix = Math.floor(Date.now() / 1000);
  const cutoff = nowUnix - HOME_NEW_WINDOW_SECONDS;
  const newPostings = postings
    .filter((p) => p.datePosted >= cutoff && !hasInteraction(dismissedSet, p))
    .sort((a, b) => b.datePosted - a.datePosted);
  const savedPostings = postings
    .filter((p) => hasInteraction(savedIdSet, p) && !hasInteraction(dismissedSet, p))
    .sort((a, b) => {
      const aSavedAt = interactionDate(savedAtById, a);
      const bSavedAt = interactionDate(savedAtById, b);
      return bSavedAt.localeCompare(aSavedAt);
    });

  const briefing = buildHomeBriefing({
    postings,
    nowUnix,
    favoriteSlugs: new Set(favoriteSlugs),
    dismissedIds: dismissedSet,
    trackedUrls,
  });

  return (
    <Home
      applications={activeApplications}
      briefing={briefing}
      starredCompanyCount={favoriteSlugs.length}
      newPostings={newPostings}
      dismissedIds={dismissedIds}
      savedIds={Array.from(savedAtById.keys())}
      savedPostings={savedPostings}
      trackedUrls={Array.from(trackedUrls)}
      quickTrackEnabled={preferencesRes.data?.quick_track_enabled ?? false}
    />
  );
}
