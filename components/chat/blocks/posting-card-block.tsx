"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ChatPostingCardResult } from "@/lib/chat/types";
import { PostingRecordRow } from "@/components/openings/posting-record-row";
import { ChatDataCard } from "@/components/chat/chat-panel";
import { createApplication } from "@/lib/actions/applications";
import { savePosting, unsavePosting } from "@/lib/actions/feed";
import { buildTrackApplicationFormData } from "@/lib/feed/build-track-form-data";
import type { FeedPosting } from "@/lib/feed/source";
import { normalizeUrl } from "@/lib/url";

export function PostingCardBlock({
  result,
  trackedUrls,
  savedIds,
}: {
  result: ChatPostingCardResult;
  trackedUrls: string[];
  savedIds: string[];
}) {
  const router = useRouter();
  const [trackPendingId, setTrackPendingId] = useState<string | null>(null);
  const [pendingSavedIds, setPendingSavedIds] = useState<Set<string>>(() => new Set());
  const trackedSet = new Set(trackedUrls.map((url) => normalizeUrl(url) ?? url));
  const savedSet = new Set(savedIds);
  const posting = result.posting;
  const tracked = trackedSet.has(normalizeUrl(posting.url) ?? posting.url);

  const onTrack = useCallback(
    async (target: FeedPosting) => {
      setTrackPendingId(target.id);
      const response = await createApplication(buildTrackApplicationFormData(target));
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

  const onToggleSaved = useCallback(async (target: FeedPosting, next: boolean) => {
    setPendingSavedIds((current) => new Set(current).add(target.id));
    const response = next
      ? await savePosting(target.interactionIds)
      : await unsavePosting(target.interactionIds);
    setPendingSavedIds((current) => {
      const copy = new Set(current);
      copy.delete(target.id);
      return copy;
    });
    if ("error" in response) {
      toast.error(next ? "Unable to save" : "Unable to unsave", { description: response.error });
    }
  }, []);

  return (
    <ChatDataCard
      title="Opening"
      actions={
        result.viewAllHref ? (
          <Link href={result.viewAllHref} className="text-xs font-medium text-primary hover:underline">
            View all →
          </Link>
        ) : undefined
      }
      padding="p-0"
    >
      <PostingRecordRow
        posting={posting}
        tracked={tracked}
        saved={savedSet.has(posting.id)}
        trackPending={trackPendingId === posting.id}
        savePending={pendingSavedIds.has(posting.id)}
        onTrack={() => onTrack(posting)}
        onToggleSaved={() => onToggleSaved(posting, !savedSet.has(posting.id))}
        layout="chat"
      />
    </ChatDataCard>
  );
}
