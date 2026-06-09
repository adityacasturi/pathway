import { redirect } from "next/navigation";
import { pageMetadata } from "@/lib/metadata/page";
import { SCOUT_ENABLED } from "@/lib/config/scout";

export const metadata = pageMetadata("Scout", "Ask Scout about your applications and discover openings.");
import { ChatPage } from "@/components/chat/chat-page";
import { listChatThreads } from "@/lib/actions/chat";
import { assertSupabaseOk } from "@/lib/supabase/errors";
import { normalizeUrl } from "@/lib/url";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ChatRoute({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!SCOUT_ENABLED) redirect("/home");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/chat");
  }

  const [threadsResult, appsResult, interactionsResult] = await Promise.all([
    listChatThreads(),
    supabase
      .from("applications")
      .select("posting_url")
      .eq("user_id", user.id)
      .is("archived_at", null),
    supabase
      .from("feed_interactions")
      .select("posting_id, kind")
      .eq("user_id", user.id),
  ]);

  if ("error" in threadsResult) {
    throw new Error(`Load chat threads failed: ${threadsResult.error}`);
  }
  assertSupabaseOk(appsResult.error, "Load chat tracked applications");
  assertSupabaseOk(interactionsResult.error, "Load chat feed interactions");

  const threads = "threads" in threadsResult ? threadsResult.threads : [];
  const trackedUrls = (appsResult.data ?? [])
    .map((row) => normalizeUrl(row.posting_url))
    .filter((url): url is string => Boolean(url));

  const savedIdSet = new Set<string>();
  for (const row of interactionsResult.data ?? []) {
    if (row.kind === "saved") savedIdSet.add(row.posting_id);
  }

  await searchParams;

  return (
    <ChatPage
      initialThreads={threads}
      trackedUrls={trackedUrls}
      savedIds={[...savedIdSet]}
    />
  );
}
