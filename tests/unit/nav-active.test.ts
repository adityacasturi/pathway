import assert from "node:assert/strict";
import test from "node:test";
import { getActiveNavHref, isActiveNavHref } from "../../lib/config/nav.ts";

test("getActiveNavHref resolves nested routes to their nav root", () => {
  assert.equal(getActiveNavHref("/companies"), "/companies");
  assert.equal(getActiveNavHref("/openings"), "/openings");
  assert.equal(getActiveNavHref("/applications/123"), "/applications");
  assert.equal(getActiveNavHref("/settings/profile"), "/settings");
});

test("isActiveNavHref only matches the current nav section", () => {
  assert.equal(isActiveNavHref("/companies", "/companies"), true);
  assert.equal(isActiveNavHref("/companies", "/openings"), false);
  assert.equal(isActiveNavHref("/openings", "/openings"), true);
  assert.equal(isActiveNavHref("/companies", "/home"), false);
  assert.equal(isActiveNavHref("/applications/123", "/applications"), true);
});
