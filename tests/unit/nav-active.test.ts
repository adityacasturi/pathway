import assert from "node:assert/strict";
import test from "node:test";
import { getActiveNavHref, isActiveNavHref } from "../../lib/config/nav.ts";

test("getActiveNavHref resolves nested routes to their nav root", () => {
  assert.equal(getActiveNavHref("/discover"), "/discover");
  assert.equal(getActiveNavHref("/applications/123"), "/applications");
  assert.equal(getActiveNavHref("/settings/profile"), "/settings");
});

test("isActiveNavHref only matches the current nav section", () => {
  assert.equal(isActiveNavHref("/discover", "/discover"), true);
  assert.equal(isActiveNavHref("/discover", "/home"), false);
  assert.equal(isActiveNavHref("/applications/123", "/applications"), true);
});
