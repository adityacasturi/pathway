import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchFeed } from "@/lib/feed/source";
import { normalizeUrl } from "@/lib/url";
import { Home } from "@/components/home";
import { normalizeApplicationState } from "@/lib/config/application-state";
import { assertSupabaseOk } from "@/lib/supabase/errors";
import type { FeedPosting } from "@/lib/feed/source";
import type { Application } from "@/types/application";

export const dynamic = "force-dynamic";

const NEW_WINDOW_SECONDS = 24 * 60 * 60;

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

  // One parallel fan-out for everything Home needs. RLS means we can fire
  // user-scoped Supabase calls without waiting on auth first — the auth check
  // happens inline below once all four responses are back.
  const [userResult, postings, appsRes, interactionsRes] = await Promise.all([
    supabase.auth.getUser(),
    fetchFeed(),
    supabase
      .from("applications")
      .select("*, application_events(*)"),
    supabase.from("feed_interactions").select("posting_id, kind, created_at"),
  ]);

  if (!userResult.data.user) redirect("/login");
  assertSupabaseOk(appsRes.error, "Load applications");
  assertSupabaseOk(interactionsRes.error, "Load feed interactions");

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

  // "New" = posted in the last 24h and not explicitly dismissed. We keep the
  // window tight so the home surface stays a quick glance; Discover is where
  // the user goes for the full firehose.
  // eslint-disable-next-line react-hooks/purity
  const cutoff = Math.floor(Date.now() / 1000) - NEW_WINDOW_SECONDS;
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

  return (
    <Home
      applications={activeApplications}
      newPostings={newPostings}
      dismissedIds={dismissedIds}
      savedIds={Array.from(savedAtById.keys())}
      savedPostings={savedPostings}
      trackedUrls={Array.from(trackedUrls)}
    />
  );
}
