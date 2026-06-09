import assert from "node:assert/strict";
import test from "node:test";
import {
  ALERT_UNSUBSCRIBE_TOKEN_TTL_MS,
  createUnsubscribeToken,
  verifyUnsubscribeToken,
} from "../../lib/alerts/unsubscribe-token.ts";

const SECRET = "test-secret";
const USER_ID = "11111111-1111-4111-8111-111111111111";

test("round-trip unsubscribe token", () => {
  const token = createUnsubscribeToken(USER_ID, SECRET);
  const verified = verifyUnsubscribeToken(token, SECRET);
  assert.equal(verified?.userId, USER_ID);
  assert.ok(verified?.nonce);
});

test("verify rejects tampered token", () => {
  const token = createUnsubscribeToken(USER_ID, SECRET);
  assert.equal(verifyUnsubscribeToken(token + "x", SECRET), null);
});

test("verify rejects expired token", () => {
  const token = createUnsubscribeToken(USER_ID, SECRET, { ttlMs: 1 });
  const expiredAt = Date.now() + ALERT_UNSUBSCRIBE_TOKEN_TTL_MS + 5;
  assert.equal(verifyUnsubscribeToken(token, SECRET, expiredAt), null);
});

test("verify rejects invalid user id in payload", () => {
  const token = createUnsubscribeToken("not-a-uuid", SECRET);
  assert.equal(verifyUnsubscribeToken(token, SECRET), null);
});

test("verify rejects oversized tokens before decoding", () => {
  assert.equal(verifyUnsubscribeToken("a".repeat(5000), SECRET), null);
});
