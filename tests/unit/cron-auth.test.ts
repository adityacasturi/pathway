import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { isCronAuthorized } from "../../lib/cron/is-authorized.ts";

describe("isCronAuthorized", () => {
  const original = process.env.CRON_SECRET;

  after(() => {
    if (original === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = original;
    }
  });

  it("returns false when secret is unset", () => {
    delete process.env.CRON_SECRET;
    const request = new Request("https://example.com", {
      headers: { authorization: "Bearer anything" },
    });
    assert.equal(isCronAuthorized(request), false);
  });

  it("returns true for matching bearer token", () => {
    process.env.CRON_SECRET = "test-secret-value";
    const request = new Request("https://example.com", {
      headers: { authorization: "Bearer test-secret-value" },
    });
    assert.equal(isCronAuthorized(request), true);
  });

  it("returns false for wrong token length or value", () => {
    process.env.CRON_SECRET = "test-secret-value";
    const request = new Request("https://example.com", {
      headers: { authorization: "Bearer wrong" },
    });
    assert.equal(isCronAuthorized(request), false);
  });
});
