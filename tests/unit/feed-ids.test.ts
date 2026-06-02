import assert from "node:assert/strict";
import test from "node:test";
import { stablePostingId, urlDedupeKey } from "../../lib/feed/ids.ts";

test("urlDedupeKey normalizes host, trailing slash, and preserves query", () => {
  assert.equal(
    urlDedupeKey("https://WWW.Example.com/jobs/123/"),
    urlDedupeKey("https://example.com/jobs/123"),
  );
  assert.equal(
    urlDedupeKey("https://example.com/jobs?id=1"),
    "example.com/jobs?id=1",
  );
});

test("stablePostingId is stable for equivalent URLs", () => {
  const a = stablePostingId("https://example.com/jobs/1");
  const b = stablePostingId("https://www.example.com/jobs/1/");
  assert.equal(a, b);
  assert.match(a, /^job_/);
});

test("stablePostingId falls back for invalid URLs", () => {
  const id = stablePostingId("  Not-A-URL  ");
  assert.match(id, /^job_/);
});
