import assert from "node:assert/strict";
import test from "node:test";

import { isDiscoverPostingVisibleByState } from "@/lib/discover/posting-feed";

const posting = {
  postingUrl: "example.com/jobs/123",
  interactionIds: ["stable-id", "legacy-id"],
};

test("discover posting visibility hides tracked postings by normalized URL", () => {
  assert.equal(
    isDiscoverPostingVisibleByState(posting, {
      trackedUrls: new Set(["https://example.com/jobs/123"]),
      dismissedIds: new Set(),
      showDismissed: false,
    }),
    false,
  );
});

test("discover posting visibility hides dismissed postings by default", () => {
  assert.equal(
    isDiscoverPostingVisibleByState(posting, {
      trackedUrls: new Set(),
      dismissedIds: new Set(["legacy-id"]),
      showDismissed: false,
    }),
    false,
  );
});

test("discover posting visibility can show dismissed postings", () => {
  assert.equal(
    isDiscoverPostingVisibleByState(posting, {
      trackedUrls: new Set(),
      dismissedIds: new Set(["legacy-id"]),
      showDismissed: true,
    }),
    true,
  );
});
