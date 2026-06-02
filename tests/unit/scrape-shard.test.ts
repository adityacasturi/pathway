import assert from "node:assert/strict";
import test from "node:test";
import { parseScrapeCronParams } from "../../lib/cron/scrape-request.ts";
import {
  sourceBelongsToShard,
  stableShardForKey,
  type ScrapeSourceShard,
} from "../../lib/scraping/run-all.ts";
import type { CompanySourceConfig } from "../../lib/scraping/types.ts";

test("parseScrapeCronParams accepts unsharded scrape defaults", () => {
  const result = parseScrapeCronParams(new URLSearchParams());
  assert.deepEqual(result, { ok: true, value: { includeAlerts: true } });
});

test("parseScrapeCronParams accepts sharded scrape with skipped alerts", () => {
  const result = parseScrapeCronParams(new URLSearchParams("shard=2&shards=4&alerts=0"));
  assert.deepEqual(result, {
    ok: true,
    value: { includeAlerts: false, sourceShard: { index: 2, count: 4 } },
  });
});

test("parseScrapeCronParams rejects malformed shard params", () => {
  assert.equal(parseScrapeCronParams(new URLSearchParams("shard=1")).ok, false);
  assert.equal(parseScrapeCronParams(new URLSearchParams("shard=-1&shards=4")).ok, false);
  assert.equal(parseScrapeCronParams(new URLSearchParams("shard=4&shards=4")).ok, false);
  assert.equal(parseScrapeCronParams(new URLSearchParams("shard=0&shards=20")).ok, false);
});

test("stableShardForKey is deterministic and bounded", () => {
  const first = stableShardForKey("stripe\u001fgreenhouse", 4);
  const second = stableShardForKey("stripe\u001fgreenhouse", 4);
  assert.equal(first, second);
  assert.ok(first >= 0 && first < 4);
  assert.throws(() => stableShardForKey("stripe", 0), /positive integer/);
});

test("sourceBelongsToShard assigns each source to exactly one shard", () => {
  const source = sampleSource("stripe");
  const matches = Array.from({ length: 4 }, (_, index) =>
    sourceBelongsToShard(source, { index, count: 4 } satisfies ScrapeSourceShard),
  );
  assert.equal(matches.filter(Boolean).length, 1);
});

function sampleSource(companySlug: string): CompanySourceConfig {
  return {
    id: `source-${companySlug}`,
    companyId: `company-${companySlug}`,
    companySlug,
    companyName: companySlug,
    sourceType: "greenhouse",
    adapterKey: "greenhouse",
    sourceUrl: `https://job-boards.greenhouse.io/${companySlug}`,
    boardToken: companySlug,
  };
}
