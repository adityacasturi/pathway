import assert from "node:assert/strict";
import test from "node:test";
import { cn, formatDate } from "../../lib/utils.ts";

test("cn merges tailwind classes with later wins", () => {
  assert.equal(cn("px-2", "px-4", false && "hidden", "text-sm"), "px-4 text-sm");
});

test("formatDate renders ISO dates for display", () => {
  assert.equal(formatDate("2026-03-15"), "Mar 15, 2026");
});
