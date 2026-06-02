import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchJsonWithTimeout,
  fetchWithTimeout,
  isRetryableFetchError,
  isRetryableFetchStatus,
  parseRetryAfterMs,
} from "../../lib/scraping/adapters/shared.ts";

test("retryable scraper statuses match transient ATS failures", () => {
  assert.equal(isRetryableFetchStatus(408), true);
  assert.equal(isRetryableFetchStatus(429), true);
  assert.equal(isRetryableFetchStatus(500), true);
  assert.equal(isRetryableFetchStatus(503), true);
  assert.equal(isRetryableFetchStatus(404), false);
  assert.equal(isRetryableFetchStatus(422), false);
});

test("retry-after parser accepts seconds and HTTP dates", () => {
  assert.equal(parseRetryAfterMs("2"), 2000);
  assert.equal(parseRetryAfterMs("not a date"), null);

  const future = new Date(Date.now() + 10_000).toUTCString();
  const parsed = parseRetryAfterMs(future);
  assert.ok(parsed !== null && parsed > 0 && parsed <= 10_000);
});

test("fetchWithTimeout retries retryable HTTP statuses", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    if (calls === 1) {
      return new Response("try again", { status: 429 });
    }
    return new Response("ok", { status: 200 });
  }) as typeof fetch;

  try {
    const response = await fetchWithTimeout(
      "https://example.test/jobs",
      {},
      { maxAttempts: 2, retryDelayMs: 0 },
    );
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "ok");
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchWithTimeout retries transient network failures", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    if (calls === 1) {
      throw new TypeError("fetch failed");
    }
    return new Response("ok", { status: 200 });
  }) as typeof fetch;

  try {
    assert.equal(isRetryableFetchError(new TypeError("fetch failed")), true);
    const response = await fetchWithTimeout(
      "https://example.test/jobs",
      {},
      { maxAttempts: 2, retryDelayMs: 0 },
    );
    assert.equal(response.status, 200);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchJsonWithTimeout sends default ATS JSON headers", async () => {
  const originalFetch = globalThis.fetch;
  const captured: { headers?: Headers } = {};
  globalThis.fetch = (async (_url, init) => {
    captured.headers = new Headers(init?.headers);
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  try {
    const response = await fetchJsonWithTimeout("https://example.test/jobs");
    assert.equal(response.status, 200);
    assert.ok(captured.headers);
    assert.equal(captured.headers.get("accept"), "application/json");
    assert.match(captured.headers.get("user-agent") ?? "", /Pathway internship tracker scraper/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
