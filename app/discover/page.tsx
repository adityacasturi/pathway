import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchFeed } from "@/lib/feed/source";
import { normalizeUrl } from "@/lib/url";
import { DiscoverFeed } from "@/components/discover-feed";
import { assertSupabaseOk } from "@/lib/supabase/errors";
import { resolveDiscoverCutoffDate } from "@/lib/config/discover";

export const dynamic = "force-dynamic";

interface DiscoverPageProps {
  searchParams: Promise<{ q?: string | string[]; saved?: string | string[] }>;
}

export default async function DiscoverPage({ searchParams }: DiscoverPageProps) {
  const supabase = await createClient();
  const params = await searchParams;
  const initialQuery = typeof params.q === "string" ? params.q : "";
  const initialSavedOnly = params.saved !== undefined;

  // Auth, feed fetch, and user-scoped queries all race in parallel. RLS
  // scopes the two Supabase queries without us needing user.id first, so
  // we avoid the auth-then-data waterfall (~100ms saved per load). The
  // feed fetch is ISR-cached in fetchFeed() so it rarely hits GitHub.
  const [userResult, postings, interactionsRes, appsRes, preferencesRes] = await Promise.all([
    supabase.auth.getUser(),
    fetchFeed(),
    supabase.from("feed_interactions").select("posting_id, kind"),
    supabase.from("applications").select("posting_url").is("archived_at", null),
    supabase.from("user_preferences").select("discover_cutoff_date").maybeSingle(),
  ]);

  if (!userResult.data.user) redirect("/login");
  assertSupabaseOk(interactionsRes.error, "Load feed interactions");
  assertSupabaseOk(appsRes.error, "Load tracked applications");
  assertSupabaseOk(preferencesRes.error, "Load preferences");

  const cutoff = resolveDiscoverCutoffDate(preferencesRes.data?.discover_cutoff_date);
  const visiblePostings = postings.filter((posting) => posting.datePosted >= cutoff.cutoffUnix);

  const dismissedIds = new Set<string>();
  const savedIds = new Set<string>();
  for (const row of interactionsRes.data ?? []) {
    if (row.kind === "dismissed") dismissedIds.add(row.posting_id);
    if (row.kind === "saved") savedIds.add(row.posting_id);
  }

  // Cross-reference tracked postings by normalized URL. This is why "tracked"
  // isn't its own interaction kind — adding an application from the feed
  // writes the url, and the next render picks it up automatically.
  const trackedUrls = new Set<string>();
  for (const row of appsRes.data ?? []) {
    const normalized = normalizeUrl(row.posting_url);
    if (normalized) trackedUrls.add(normalized);
  }

  return (
    <DiscoverFeed
      postings={visiblePostings}
      dismissedIds={Array.from(dismissedIds)}
      savedIds={Array.from(savedIds)}
      trackedUrls={Array.from(trackedUrls)}
      oldestAllowedCutoffDate={cutoff.oldestAllowedDate}
      latestAllowedCutoffDate={cutoff.today}
      initialQuery={initialQuery}
      initialSavedOnly={initialSavedOnly}
    />
  );
}
