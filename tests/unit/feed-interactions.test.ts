import assert from "node:assert/strict";
import test from "node:test";

import { applyInteractionIds, hasAnyInteraction } from "@/lib/feed/interactions";

test("hasAnyInteraction matches any stable or legacy interaction id", () => {
  assert.equal(hasAnyInteraction(new Set(["legacy-id"]), ["stable-id", "legacy-id"]), true);
  assert.equal(hasAnyInteraction(new Set(["other-id"]), ["stable-id", "legacy-id"]), false);
});

test("applyInteractionIds adds and removes all interaction aliases without mutating input", () => {
  const current = new Set(["keep-id"]);

  const added = applyInteractionIds(current, ["stable-id", "legacy-id"], true);

  assert.deepEqual([...current], ["keep-id"]);
  assert.deepEqual([...added].sort(), ["keep-id", "legacy-id", "stable-id"]);

  const removed = applyInteractionIds(added, ["stable-id", "legacy-id"], false);

  assert.deepEqual([...removed], ["keep-id"]);
});
