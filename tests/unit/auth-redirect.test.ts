import assert from "node:assert/strict";
import test from "node:test";
import { getSafeInternalPath } from "../../lib/auth/redirect.ts";

test("getSafeInternalPath accepts same-origin app paths with query strings", () => {
  assert.equal(
    getSafeInternalPath("/openings?q=software", "/home"),
    "/openings?q=software",
  );
});

test("getSafeInternalPath rejects external and malformed redirects", () => {
  assert.equal(getSafeInternalPath("https://evil.example", "/home"), "/home");
  assert.equal(getSafeInternalPath("//evil.example", "/home"), "/home");
  assert.equal(getSafeInternalPath("/\\evil.example", "/home"), "/home");
});

test("getSafeInternalPath rejects configured auth loop prefixes", () => {
  assert.equal(
    getSafeInternalPath("/login?next=/settings", "/home", {
      blockedPrefixes: ["/login", "/register"],
    }),
    "/home",
  );
  assert.equal(
    getSafeInternalPath("/register/extra", "/home", {
      blockedPrefixes: ["/login", "/register"],
    }),
    "/home",
  );
});
