import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDays,
  formatDecimal,
  formatPercent,
  pluralize,
  sampleDetail,
} from "../../lib/stats/applications.ts";

test("pluralize and sampleDetail handle singular forms", () => {
  assert.equal(pluralize(1, "application"), "application");
  assert.equal(pluralize(2, "application"), "applications");
  assert.equal(sampleDetail(1), "1 application sample");
});

test("formatDays and formatDecimal render readable metrics", () => {
  assert.equal(formatDays(null), "n/a");
  assert.equal(formatDays(3.44), "3.4d");
  assert.equal(formatDays(12.2), "12d");
  assert.equal(formatDecimal(4), "4");
  assert.equal(formatDecimal(4.25), "4.3");
});

test("formatPercent guards zero denominators", () => {
  assert.equal(formatPercent(0, 0), "0%");
  assert.equal(formatPercent(1, 4), "25%");
});
