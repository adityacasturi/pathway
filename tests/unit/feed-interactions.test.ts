import assert from "node:assert/strict";
import test from "node:test";

import {
  applyInteractionIds,
  applyInteractionOverride,
  hasAnyInteraction,
  resolveInteractionSet,
} from "@/lib/feed/interactions";

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

test("resolveInteractionSet applies optimistic overrides without mutating server ids", () => {
  const serverIds = new Set(["stable-id", "keep-id"]);
  const overrides = new Map([
    ["stable-id", false],
    ["legacy-id", false],
    ["new-id", true],
  ]);

  const resolved = resolveInteractionSet(serverIds, overrides);

  assert.deepEqual([...serverIds].sort(), ["keep-id", "stable-id"]);
  assert.deepEqual([...resolved].sort(), ["keep-id", "new-id"]);
});

test("applyInteractionOverride records all interaction aliases without mutating input", () => {
  const current = new Map([["keep-id", true]]);

  const next = applyInteractionOverride(current, ["stable-id", "legacy-id"], false);

  assert.deepEqual([...current], [["keep-id", true]]);
  assert.deepEqual(
    [...next.entries()].sort(([a], [b]) => a.localeCompare(b)),
    [
      ["keep-id", true],
      ["legacy-id", false],
      ["stable-id", false],
    ],
  );
});
