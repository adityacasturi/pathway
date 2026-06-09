"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ChatPostingListResult } from "@/lib/chat/types";
import { PostingRecordRow } from "@/components/openings/posting-record-row";
import { ChatDataCard } from "@/components/chat/chat-panel";
import { createApplication } from "@/lib/actions/applications";
import { savePosting, unsavePosting } from "@/lib/actions/feed";
import { buildTrackApplicationFormData } from "@/lib/feed/build-track-form-data";
import type { FeedPosting } from "@/lib/feed/source";
import { normalizeUrl } from "@/lib/url";

export function PostingListBlock({
  result,
  trackedUrls,
  savedIds,
}: {
  result: ChatPostingListResult;
  trackedUrls: string[];
  savedIds: string[];
}) {
  const router = useRouter();
  const [trackPendingId, setTrackPendingId] = useState<string | null>(null);
  const [pendingSavedIds, setPendingSavedIds] = useState<Set<string>>(() => new Set());
  const trackedSet = new Set(trackedUrls.map((url) => normalizeUrl(url) ?? url));
  const savedSet = new Set(savedIds);

  const onTrack = useCallback(
    async (posting: FeedPosting) => {
      setTrackPendingId(posting.id);
      const response = await createApplication(buildTrackApplicationFormData(posting));
      setTrackPendingId(null);
      if ("error" in response) {
        toast.error("Unable to track role", { description: response.error });
        return;
      }
      router.refresh();
      toast.success("Added to Applications");
    },
    [router],
  );

  const onToggleSaved = useCallback(async (posting: FeedPosting, next: boolean) => {
    setPendingSavedIds((current) => new Set(current).add(posting.id));
    const response = next
      ? await savePosting(posting.interactionIds)
      : await unsavePosting(posting.interactionIds);
    setPendingSavedIds((current) => {
      const copy = new Set(current);
      copy.delete(posting.id);
      return copy;
    });
    if ("error" in response) {
      toast.error(next ? "Unable to save" : "Unable to unsave", { description: response.error });
    }
  }, []);

  return (
    <ChatDataCard
      title={result.title}
      actions={
        result.viewAllHref ? (
          <Link href={result.viewAllHref} className="text-xs font-medium text-primary hover:underline">
            View all →
          </Link>
        ) : undefined
      }
      padding="p-0"
    >
      <ul className="divide-y divide-border/60">
        {result.postings.map((posting) => {
          const tracked = trackedSet.has(normalizeUrl(posting.url) ?? posting.url);
          return (
            <PostingRecordRow
              key={posting.id}
              posting={posting}
              saved={savedSet.has(posting.id)}
              tracked={tracked}
              trackPending={trackPendingId === posting.id}
              savePending={pendingSavedIds.has(posting.id)}
              onTrack={() => onTrack(posting)}
              onToggleSaved={() => onToggleSaved(posting, !savedSet.has(posting.id))}
              layout="chat"
            />
          );
        })}
      </ul>
      {result.truncated ? (
        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          Showing {result.postings.length} of {result.totalCount}
        </div>
      ) : null}
    </ChatDataCard>
  );
}
