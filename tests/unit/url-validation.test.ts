import assert from "node:assert/strict";
import test from "node:test";
import {
  displayUrl,
  normalizeUrl,
  safeExternalHref,
  validateExternalHttpUrl,
} from "../../lib/url.ts";

test("normalizeUrl trims, rejects blank, and prepends https", () => {
  assert.equal(normalizeUrl("  "), null);
  assert.equal(normalizeUrl("jobs.example.com/role"), "https://jobs.example.com/role");
  assert.equal(normalizeUrl("https://example.com/a"), "https://example.com/a");
});

test("validateExternalHttpUrl blocks private hosts and bad schemes", () => {
  assert.deepEqual(validateExternalHttpUrl("http://localhost/job"), {
    url: null,
    error: "Local or private-network URLs are not allowed.",
  });
  assert.deepEqual(validateExternalHttpUrl("javascript:alert(1)"), {
    url: null,
    error: "Only http(s) URLs are allowed.",
  });
  assert.deepEqual(validateExternalHttpUrl("https://user:pass@example.com"), {
    url: null,
    error: "URLs with embedded credentials are not allowed.",
  });
  assert.deepEqual(validateExternalHttpUrl("http://0x7f000001/job"), {
    url: null,
    error: "Local or private-network URLs are not allowed.",
  });
  assert.deepEqual(validateExternalHttpUrl("http://[::ffff:127.0.0.1]/job"), {
    url: null,
    error: "Local or private-network URLs are not allowed.",
  });
});

test("validateExternalHttpUrl accepts public https URLs", () => {
  const result = validateExternalHttpUrl("example.com/apply");
  assert.equal(result.error, undefined);
  assert.equal(result.url, "https://example.com/apply");
});

test("safeExternalHref and displayUrl mirror validation and host display", () => {
  assert.equal(safeExternalHref("not a url!!!"), null);
  assert.equal(displayUrl("https://www.stripe.com/jobs"), "stripe.com");
  assert.equal(displayUrl("not-a-url"), "not-a-url");
});
