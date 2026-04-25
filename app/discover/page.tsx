import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchFeed } from "@/lib/feed/source";
import { normalizeUrl } from "@/lib/url";
import { DiscoverFeed } from "@/components/discover-feed";
import { assertSupabaseOk } from "@/lib/supabase/errors";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const supabase = await createClient();

  // Auth, feed fetch, and user-scoped queries all race in parallel. RLS
  // scopes the two Supabase queries without us needing user.id first, so
  // we avoid the auth-then-data waterfall (~100ms saved per load). The
  // feed fetch is ISR-cached in fetchFeed() so it rarely hits GitHub.
  const [userResult, postings, interactionsRes, appsRes] = await Promise.all([
    supabase.auth.getUser(),
    fetchFeed(),
    supabase.from("feed_interactions").select("posting_id").eq("kind", "dismissed"),
    supabase.from("applications").select("posting_url").is("archived_at", null),
  ]);

  if (!userResult.data.user) redirect("/login");
  assertSupabaseOk(interactionsRes.error, "Load feed interactions");
  assertSupabaseOk(appsRes.error, "Load tracked applications");

  const dismissedIds = new Set<string>(
    (interactionsRes.data ?? []).map((row) => row.posting_id),
  );

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
      postings={postings}
      dismissedIds={Array.from(dismissedIds)}
      trackedUrls={Array.from(trackedUrls)}
    />
  );
}
