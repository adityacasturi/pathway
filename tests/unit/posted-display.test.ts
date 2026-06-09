import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveEffectivePostedUnix,
  resolvePostedDisplay,
  resolvePathwayNewUnix,
  toUnixSeconds,
} from "@/lib/feed/posted-display";

const FIRST_SEEN = "2026-02-13T02:46:07.710Z";
const FIRST_SEEN_UNIX = toUnixSeconds(FIRST_SEEN);

test("resolveEffectivePostedUnix uses first_seen_at", () => {
  const row = {
    first_seen_at: FIRST_SEEN,
  };

  assert.equal(resolveEffectivePostedUnix(row), FIRST_SEEN_UNIX);
});

test("resolvePostedDisplay uses first_seen_at", () => {
  const row = {
    first_seen_at: FIRST_SEEN,
  };

  const display = resolvePostedDisplay(row);
  assert.equal(display.kind, "added");
  assert.equal(display.unixSeconds, FIRST_SEEN_UNIX);
});

test("resolvePathwayNewUnix matches effective posted unix", () => {
  const row = {
    first_seen_at: FIRST_SEEN,
  };

  assert.equal(resolvePathwayNewUnix(row), resolveEffectivePostedUnix(row));
});

test("resolvePostedDisplay falls back to none when first_seen_at is invalid", () => {
  const display = resolvePostedDisplay({
    first_seen_at: "",
  });

  assert.equal(display.kind, "none");
  assert.equal(display.unixSeconds, 0);
});
