import { redirect } from "next/navigation";
import { pageMetadata } from "@/lib/metadata/page";

export const metadata = pageMetadata("Home", "Your internship search dashboard.");
import { HomePage } from "@/components/home/home-page";
import { normalizeApplicationState } from "@/lib/config/application-state";
import { fetchFeed } from "@/lib/feed/source";
import { loadHomeAlertActivity } from "@/lib/home/alert-activity";
import {
  buildHotCompanies,
  HOME_HOT_COMPANIES_POOL,
} from "@/lib/home/briefing";
import { buildSeasonSnapshot } from "@/lib/home/season-snapshot";
import { assertSupabaseOk } from "@/lib/supabase/errors";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { currentUnixSeconds } from "@/lib/time";
import type { FeedPosting } from "@/lib/feed/source";

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

export default async function HomeRoute() {
  const nowUnix = currentUnixSeconds();

  const { supabase, user } = await getAuthenticatedUser();

  if (!user) redirect("/login?next=/home");
  const userId = user.id;

  const [postings, alertActivity, appsRes, interactionsRes] = await Promise.all([
    fetchFeed(),
    loadHomeAlertActivity(supabase, userId, nowUnix),
    supabase
      .from("applications")
      .select("*, application_events(*)")
      .eq("user_id", userId),
    supabase
      .from("feed_interactions")
      .select("posting_id, kind, created_at")
      .eq("user_id", userId),
  ]);

  assertSupabaseOk(appsRes.error, "Load applications");
  assertSupabaseOk(interactionsRes.error, "Load feed interactions");

  const activeApplications = (appsRes.data ?? [])
    .filter((row) => !row.archived_at)
    .map((row) =>
      normalizeApplicationState({
        ...row,
        events: row.application_events ?? [],
        last_activity_date: row.created_at.slice(0, 10),
      }),
    );

  const dismissedIds = new Set<string>();
  const savedAtById = new Map<string, string>();
  for (const row of interactionsRes.data ?? []) {
    if (row.kind === "dismissed") dismissedIds.add(row.posting_id);
    if (row.kind === "saved") {
      const existing = savedAtById.get(row.posting_id);
      if (!existing || row.created_at > existing) {
        savedAtById.set(row.posting_id, row.created_at);
      }
    }
  }
  const savedIdSet = new Set(savedAtById.keys());

  const recentPool = postings
    .filter((posting) => !hasInteraction(dismissedIds, posting))
    .sort((a, b) => b.datePosted - a.datePosted);
  const recentTotal = recentPool.length;

  const savedPool = postings
    .filter((posting) => hasInteraction(savedIdSet, posting) && !hasInteraction(dismissedIds, posting))
    .sort((a, b) => interactionDate(savedAtById, b).localeCompare(interactionDate(savedAtById, a)));
  const savedTotal = savedPool.length;

  const hotCompanies = buildHotCompanies(postings, {
    nowUnix,
    limit: HOME_HOT_COMPANIES_POOL,
  });

  const seasonSnapshot = buildSeasonSnapshot(activeApplications);

  return (
    <HomePage
      seasonSnapshot={seasonSnapshot}
      hotCompanies={hotCompanies}
      alertActivity={alertActivity}
      savedPostings={savedPool}
      savedTotal={savedTotal}
      recentPostings={recentPool}
      recentTotal={recentTotal}
    />
  );
}
