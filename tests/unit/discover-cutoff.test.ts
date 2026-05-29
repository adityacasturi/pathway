import assert from "node:assert/strict";
import test from "node:test";
import {
  getDefaultDiscoverCutoffDate,
  resolveDiscoverCutoffDate,
} from "../../lib/config/discover.ts";

test("getDefaultDiscoverCutoffDate uses March 31 of the current year when past spring", () => {
  assert.equal(
    getDefaultDiscoverCutoffDate(new Date("2026-05-28T12:00:00.000Z")),
    "2026-03-31",
  );
});

test("getDefaultDiscoverCutoffDate uses prior March 31 before spring", () => {
  assert.equal(
    getDefaultDiscoverCutoffDate(new Date("2026-02-10T12:00:00.000Z")),
    "2025-03-31",
  );
});

test("resolveDiscoverCutoffDate defaults to March 31 when no preference is stored", () => {
  const resolved = resolveDiscoverCutoffDate(null, new Date("2026-05-28T12:00:00.000Z"));
  assert.equal(resolved.cutoffDate, "2026-03-31");
});
