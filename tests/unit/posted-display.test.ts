import assert from "node:assert/strict";
import test from "node:test";
import { formatPostingRelativeTime, resolveEffectivePostedUnix, resolvePathwayNewUnix, resolvePostedDisplay } from "../../lib/feed/posted-display.ts";

test("resolvePostedDisplay uses Posted for high-confidence ats_publish", () => {
  const display = resolvePostedDisplay({
    date_posted: "2026-04-01T12:00:00.000Z",
    date_posted_source: "ats_publish",
    date_posted_confidence: "high",
    first_seen_at: "2026-05-01T00:00:00.000Z",
  });
  assert.equal(display.kind, "posted");
});

test("resolvePostedDisplay uses added kind for unknown publish", () => {
  const display = resolvePostedDisplay({
    date_posted: null,
    date_posted_source: "unknown",
    date_posted_confidence: "unknown",
    first_seen_at: "2026-05-01T00:00:00.000Z",
  });
  assert.equal(display.kind, "added");
  assert.match(formatPostingRelativeTime(display), /ago$/);
});

test("resolvePostedDisplay omits line for low-confidence modified source", () => {
  const display = resolvePostedDisplay({
    date_posted: "2026-05-30T00:00:00.000Z",
    date_posted_source: "ats_modified",
    date_posted_confidence: "low",
    first_seen_at: "2026-05-01T00:00:00.000Z",
  });
  assert.equal(display.kind, "added");
});

test("resolvePathwayNewUnix uses first_seen_at", () => {
  const unix = resolvePathwayNewUnix({ first_seen_at: "2026-05-15T00:00:00.000Z" });
  assert.equal(unix, Math.floor(Date.parse("2026-05-15T00:00:00.000Z") / 1000));
});

test("resolveEffectivePostedUnix falls back to first_seen when publish not displayable", () => {
  const unix = resolveEffectivePostedUnix({
    date_posted: "2026-04-01T00:00:00.000Z",
    date_posted_source: "sitemap",
    date_posted_confidence: "low",
    first_seen_at: "2026-05-15T00:00:00.000Z",
  });
  assert.equal(unix, Math.floor(Date.parse("2026-05-15T00:00:00.000Z") / 1000));
});
