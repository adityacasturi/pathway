import type { FeedPosting } from "@/lib/feed/types";
import { hasAnyInteraction } from "@/lib/feed/interactions";

export interface FeedVisibilityState {
  trackedIds: ReadonlySet<string>;
  savedIds: ReadonlySet<string>;
  showSavedOnly: boolean;
}

/** Applied (tracked) roles are hidden unless the user is viewing saved-only. */
export function isFeedPostingVisibleByState(
  posting: Pick<FeedPosting, "id" | "interactionIds">,
  state: FeedVisibilityState,
): boolean {
  if (state.showSavedOnly) {
    return hasAnyInteraction(state.savedIds, posting.interactionIds);
  }

  return !state.trackedIds.has(posting.id);
}
