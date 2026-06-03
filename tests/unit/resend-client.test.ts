import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyResendFailure,
  shouldStopResendBatch,
} from "../../lib/email/resend-client.ts";

describe("classifyResendFailure", () => {
  it("treats HTTP 429 as rate_limit", () => {
    assert.equal(classifyResendFailure(429, "Too many requests"), "rate_limit");
  });

  it("treats quota messages as quota", () => {
    assert.equal(classifyResendFailure(403, "Daily limit exceeded"), "quota");
  });

  it("treats server errors as transient", () => {
    assert.equal(classifyResendFailure(502, "Bad gateway"), "transient");
  });
});

describe("shouldStopResendBatch", () => {
  it("stops only on rate_limit and quota", () => {
    assert.equal(shouldStopResendBatch("rate_limit"), true);
    assert.equal(shouldStopResendBatch("quota"), true);
    assert.equal(shouldStopResendBatch("transient"), false);
    assert.equal(shouldStopResendBatch("invalid"), false);
  });
});
