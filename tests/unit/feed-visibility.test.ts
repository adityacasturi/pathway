import assert from "node:assert/strict";
import test from "node:test";

import { isFeedPostingVisibleByState } from "@/lib/feed/visibility";

const posting = {
  id: "stable-id",
  interactionIds: ["stable-id", "legacy-id"],
};

test("feed visibility hides applied postings by default", () => {
  assert.equal(
    isFeedPostingVisibleByState(posting, {
      trackedIds: new Set(["stable-id"]),
      savedIds: new Set(),
      showSavedOnly: false,
    }),
    false,
  );
});

test("feed visibility shows untracked postings", () => {
  assert.equal(
    isFeedPostingVisibleByState(posting, {
      trackedIds: new Set(["other-id"]),
      savedIds: new Set(),
      showSavedOnly: false,
    }),
    true,
  );
});

test("feed visibility saved-only mode includes saved postings even when applied", () => {
  assert.equal(
    isFeedPostingVisibleByState(posting, {
      trackedIds: new Set(["stable-id"]),
      savedIds: new Set(["stable-id"]),
      showSavedOnly: true,
    }),
    true,
  );
});

test("feed visibility saved-only mode excludes unsaved postings", () => {
  assert.equal(
    isFeedPostingVisibleByState(posting, {
      trackedIds: new Set(),
      savedIds: new Set(["other-id"]),
      showSavedOnly: true,
    }),
    false,
  );
});
