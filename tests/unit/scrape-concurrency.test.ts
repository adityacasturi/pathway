import assert from "node:assert/strict";
import test from "node:test";
import {
  hostConcurrencyLimit,
  mapWithConcurrency,
  resolveScrapeHostKey,
  ScrapeConcurrencyPool,
} from "../../lib/scraping/scrape-concurrency.ts";

test("resolveScrapeHostKey buckets Workday tenants", () => {
  assert.equal(
    resolveScrapeHostKey({
      sourceType: "workday",
      sourceUrl: "https://adobe.wd5.myworkdayjobs.com/en-US/external_experienced",
    }),
    "*.myworkdayjobs.com",
  );
  assert.equal(
    resolveScrapeHostKey({
      sourceType: "greenhouse",
      sourceUrl: "https://job-boards.greenhouse.io/verkada",
    }),
    "job-boards.greenhouse.io",
  );
});

test("hostConcurrencyLimit defaults for unknown hosts", () => {
  assert.equal(hostConcurrencyLimit("boards-api.greenhouse.io"), 3);
  assert.equal(hostConcurrencyLimit("example.com"), 4);
});

test("mapWithConcurrency preserves result order", async () => {
  const results = await mapWithConcurrency([40, 10, 30], 2, async (value, index) => {
    await new Promise((resolve) => setTimeout(resolve, value - index * 5));
    return value + index;
  });
  assert.deepEqual(results, [40, 11, 32]);
});

test("ScrapeConcurrencyPool respects host concurrency", async () => {
  const pool = new ScrapeConcurrencyPool(4);
  let active = 0;
  let maxActive = 0;

  await Promise.all(
    Array.from({ length: 6 }, () =>
      pool.run("boards-api.greenhouse.io", async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 20));
        active -= 1;
      }),
    ),
  );

  assert.equal(maxActive, hostConcurrencyLimit("boards-api.greenhouse.io"));
});
