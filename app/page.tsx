import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchFeed } from "@/lib/feed/source";
import { normalizeUrl } from "@/lib/url";
import { Home } from "@/components/home";
import { STATUSES } from "@/lib/config/events";
import { assertSupabaseOk } from "@/lib/supabase/errors";
import type { Status, ApplicationEvent } from "@/types/application";

export const dynamic = "force-dynamic";

const NEW_WINDOW_SECONDS = 24 * 60 * 60;

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
      .select("id, posting_url, archived_at, application_events(event_type)"),
    supabase.from("feed_interactions").select("posting_id").eq("kind", "dismissed"),
  ]);

  if (!userResult.data.user) redirect("/login");
  assertSupabaseOk(appsRes.error, "Load applications");
  assertSupabaseOk(interactionsRes.error, "Load feed interactions");

  // Funnel counts: an application contributes to every status it has ever
  // passed through (not just its terminal state). Mirrors the dashboard so
  // numbers are consistent across pages.
  const statusCounts: Record<Status, number> = Object.fromEntries(
    STATUSES.map((s) => [s, 0]),
  ) as Record<Status, number>;

  const activeApplications = (appsRes.data ?? []).filter((app) => !app.archived_at);

  for (const app of activeApplications) {
    const seen = new Set<Status>();
    const events = (app.application_events ?? []) as Pick<ApplicationEvent, "event_type">[];
    for (const ev of events) {
      if ((STATUSES as readonly string[]).includes(ev.event_type)) {
        seen.add(ev.event_type as Status);
      }
    }
    for (const s of seen) statusCounts[s] += 1;
  }

  const totalApplications = activeApplications.length;

  const dismissedIds = (interactionsRes.data ?? []).map((row) => row.posting_id);
  const dismissedSet = new Set(dismissedIds);

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
    .filter((p) => p.datePosted >= cutoff && !dismissedSet.has(p.id))
    .sort((a, b) => b.datePosted - a.datePosted);

  return (
    <Home
      statusCounts={statusCounts}
      totalApplications={totalApplications}
      newPostings={newPostings}
      dismissedIds={dismissedIds}
      trackedUrls={Array.from(trackedUrls)}
    />
  );
}
