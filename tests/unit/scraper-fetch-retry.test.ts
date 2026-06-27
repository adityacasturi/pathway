import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchJsonPayloadWithTimeout,
  isRetryableFetchError,
} from "@/lib/scraping/adapters/shared";

test("isRetryableFetchError treats undici terminated socket errors as retryable", () => {
  const error = new TypeError("terminated", {
    cause: Object.assign(new Error("other side closed"), { code: "UND_ERR_SOCKET" }),
  });
  assert.equal(isRetryableFetchError(error), true);
});

test("fetchJsonPayloadWithTimeout retries when response body read fails", async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;

  globalThis.fetch = (async () => {
    attempts += 1;
    if (attempts === 1) {
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"results":['));
          controller.error(
            Object.assign(new TypeError("terminated"), {
              cause: Object.assign(new Error("other side closed"), { code: "UND_ERR_SOCKET" }),
            }),
          );
        },
      });
      return new Response(body, {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return Response.json({ results: [{ positionTitle: "Intern" }] });
  }) as typeof fetch;

  try {
    const { response, data } = await fetchJsonPayloadWithTimeout<{ results: Array<{ positionTitle: string }> }>(
      "https://example.test/jobs",
      {},
      { retryDelayMs: 1 },
    );
    assert.equal(response.status, 200);
    assert.equal(data.results?.[0]?.positionTitle, "Intern");
    assert.equal(attempts, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
