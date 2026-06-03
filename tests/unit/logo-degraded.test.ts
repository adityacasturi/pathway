import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isLogoDevDegraded,
  markLogoDevDegraded,
  resetLogoDevDegradedForTests,
  shouldOpenLogoDevCircuit,
} from "../../lib/logo/degraded.ts";

test("shouldOpenLogoDevCircuit opens on auth and quota upstream statuses", () => {
  assert.equal(shouldOpenLogoDevCircuit(401), true);
  assert.equal(shouldOpenLogoDevCircuit(403), true);
  assert.equal(shouldOpenLogoDevCircuit(429), true);
  assert.equal(shouldOpenLogoDevCircuit(404), false);
  assert.equal(shouldOpenLogoDevCircuit(502), false);
});

test("markLogoDevDegraded pauses logo.dev fetches until expiry", () => {
  resetLogoDevDegradedForTests();
  const now = 1_000_000;
  markLogoDevDegraded("upstream 429", 60_000, now);
  assert.equal(isLogoDevDegraded(now + 1), true);
  assert.equal(isLogoDevDegraded(now + 60_001), false);
});
