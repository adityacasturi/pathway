import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveEffectivePostedUnix,
  resolvePostedDisplay,
  toUnixSeconds,
} from "@/lib/feed/posted-display";

const FIRST_SEEN = "2026-02-13T02:46:07.710Z";
const FIRST_SEEN_UNIX = toUnixSeconds(FIRST_SEEN);
const POSTED_AT = "2026-06-04T16:57:38.597Z";
const POSTED_AT_UNIX = toUnixSeconds(POSTED_AT);

test("resolveEffectivePostedUnix uses posted_at", () => {
  const row = {
    first_seen_at: FIRST_SEEN,
    posted_at: POSTED_AT,
  };

  assert.equal(resolveEffectivePostedUnix(row), POSTED_AT_UNIX);
});

test("resolvePostedDisplay uses posted_at", () => {
  const row = {
    first_seen_at: FIRST_SEEN,
    posted_at: POSTED_AT,
  };

  const display = resolvePostedDisplay(row);
  assert.equal(display.kind, "posted");
  assert.equal(display.unixSeconds, POSTED_AT_UNIX);
});

test("resolvePostedDisplay falls back to first_seen_at when posted_at is invalid", () => {
  const display = resolvePostedDisplay({
    first_seen_at: FIRST_SEEN,
    posted_at: "",
  });

  assert.equal(display.kind, "added");
  assert.equal(display.unixSeconds, FIRST_SEEN_UNIX);
});
