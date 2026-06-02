import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fetchLogoProxy,
  getLogoProxyFetchQueueStateForTests,
  resetLogoProxyFetchQueueForTests,
} from "../../lib/logo/client-fetch-queue.ts";

test("fetchLogoProxy deduplicates by cache key", async () => {
  resetLogoProxyFetchQueueForTests({ maxConcurrent: 4, minStartGapMs: 0 });
  let fetchCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetchCount += 1;
    await new Promise((r) => setTimeout(r, 5));
    return new Response(null, { status: 200 });
  };

  try {
    const [a, b] = await Promise.all([
      fetchLogoProxy("/api/logo?company=Stripe&v=7", "name:stripe"),
      fetchLogoProxy("/api/logo?company=Stripe&v=7", "name:stripe"),
    ]);
    assert.equal(a, "ok");
    assert.equal(b, "ok");
    assert.equal(fetchCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchLogoProxy limits concurrent upstream fetches", async () => {
  resetLogoProxyFetchQueueForTests({ maxConcurrent: 3, minStartGapMs: 0 });
  let concurrent = 0;
  let maxConcurrent = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    concurrent += 1;
    maxConcurrent = Math.max(maxConcurrent, concurrent);
    await new Promise((r) => setTimeout(r, 15));
    concurrent -= 1;
    return new Response(null, { status: 200 });
  };

  try {
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        fetchLogoProxy(`/api/logo?company=c${i}&v=7`, `name:c${i}`),
      ),
    );
    assert.ok(maxConcurrent <= 3, `expected max 3 concurrent, saw ${maxConcurrent}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchLogoProxy caches missing logos", async () => {
  resetLogoProxyFetchQueueForTests({ maxConcurrent: 4, minStartGapMs: 0 });
  let fetchCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetchCount += 1;
    return new Response(null, { status: 404 });
  };

  try {
    const first = await fetchLogoProxy("/api/logo?company=Unknown&v=7", "name:unknown");
    const second = await fetchLogoProxy("/api/logo?company=Unknown&v=7", "name:unknown");
    assert.equal(first, "missing");
    assert.equal(second, "missing");
    assert.equal(fetchCount, 1);
    assert.equal(getLogoProxyFetchQueueStateForTests().cached, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
