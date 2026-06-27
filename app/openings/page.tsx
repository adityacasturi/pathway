import { redirect } from "next/navigation";
import { pageMetadata } from "@/lib/metadata/page";

export const metadata = pageMetadata("Openings", "Browse live internship openings from tracked companies.");
import { fetchFeed } from "@/lib/feed/source";
import { normalizeUrl } from "@/lib/url";
import { OpeningsPage as LiveFeed } from "@/components/openings/openings-page";
import { loadUserViewPreferences } from "@/lib/user-preferences/load-view-preferences";
import { assertSupabaseOk } from "@/lib/supabase/errors";
import { getAuthenticatedUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

interface LivePageProps {
  searchParams: Promise<{
    q?: string | string[];
    recent?: string | string[];
    posting?: string | string[];
  }>;
}

export default async function OpeningsPage({ searchParams }: LivePageProps) {
  const params = await searchParams;
  const initialQuery = typeof params.q === "string" ? params.q : "";
  const recentRaw = typeof params.recent === "string" ? params.recent : "";
  const initialRecentDays = /^\d+$/.test(recentRaw) ? Number(recentRaw) : null;
  const initialPostingId = typeof params.posting === "string" ? params.posting : "";

  const { supabase, user } = await getAuthenticatedUser();

  if (!user) redirect("/login?next=/openings");
  const userId = user.id;

  const [postings, interactionsRes, appsRes, viewPrefs] = await Promise.all([
      fetchFeed(),
      supabase.from("feed_interactions").select("posting_id").eq("user_id", userId).eq("kind", "saved"),
      supabase
        .from("applications")
        .select("posting_url")
        .eq("user_id", userId)
        .is("archived_at", null),
      loadUserViewPreferences(supabase, userId),
    ]);

  assertSupabaseOk(interactionsRes.error, "Load feed interactions");
  assertSupabaseOk(appsRes.error, "Load tracked applications");

  const savedIds = new Set<string>();
  for (const row of interactionsRes.data ?? []) {
    savedIds.add(row.posting_id);
  }

  const trackedUrls = new Set<string>();
  for (const row of appsRes.data ?? []) {
    const normalized = normalizeUrl(row.posting_url);
    if (normalized) trackedUrls.add(normalized);
  }

  return (
    <LiveFeed
      key={`${initialQuery}|${initialRecentDays ?? ""}|${initialPostingId}`}
      postings={postings}
      savedIds={Array.from(savedIds)}
      trackedUrls={Array.from(trackedUrls)}
      initialQuery={initialQuery}
      initialRecentDays={initialRecentDays}
      initialPostingId={initialPostingId || undefined}
      quickTrackEnabled={viewPrefs.quickTrackEnabled}
      initialFeedPrefs={viewPrefs.feed}
    />
  );
}
