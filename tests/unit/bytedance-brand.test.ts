import assert from "node:assert/strict";
import test from "node:test";

import {
  buildScopedPostingUrl,
  estimateByteDanceJobPostedAt,
  isByteDanceSearchDetailPageLive,
} from "@/lib/scraping/adapters/bytedance-brand";

test("buildScopedPostingUrl uses lifeattiktok search for TikTok scope", () => {
  assert.equal(
    buildScopedPostingUrl("tiktok", "en", "7534878965941766408"),
    "https://lifeattiktok.com/search/7534878965941766408",
  );
});

test("buildScopedPostingUrl uses joinbytedance search for ByteDance scope", () => {
  assert.equal(
    buildScopedPostingUrl("bytedance", "en", "7534878965941766408"),
    "https://joinbytedance.com/search/7534878965941766408",
  );
});

test("isByteDanceSearchDetailPageLive detects live job HTML", () => {
  assert.equal(isByteDanceSearchDetailPageLive("<h2>Responsibilities</h2><p>Team intro</p>"), true);
  assert.equal(isByteDanceSearchDetailPageLive("<h4>404 Page not found</h4>"), false);
});

test("estimateByteDanceJobPostedAt preserves known anchor dates", () => {
  const anchors = new Map([["7534878965941766408", "2026-05-28T15:00:00.000Z"]]);
  assert.equal(
    estimateByteDanceJobPostedAt("7534878965941766408", anchors, Date.parse("2026-06-24T12:00:00Z")),
    "2026-05-28T15:00:00.000Z",
  );
});

test("estimateByteDanceJobPostedAt spreads unknown job ids between anchors and index date", () => {
  const anchors = new Map([
    ["7534878965941766408", "2026-05-28T15:00:00.000Z"],
    ["7595707875767699765", "2026-06-04T15:00:00.000Z"],
  ]);
  const indexMs = Date.parse("2026-06-24T12:00:00Z");
  const older = Date.parse(
    estimateByteDanceJobPostedAt("7529448398338033928", anchors, indexMs),
  );
  const newer = Date.parse(
    estimateByteDanceJobPostedAt("7636711580690532613", anchors, indexMs),
  );

  assert.ok(older >= Date.parse("2026-05-28T15:00:00.000Z"));
  assert.ok(newer <= indexMs - 86_400_000);
  assert.ok(newer > older);
});
