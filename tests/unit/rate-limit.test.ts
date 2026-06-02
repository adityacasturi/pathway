import assert from "node:assert/strict";
import test from "node:test";
import { limitRequestByIp } from "../../lib/rate-limit-buckets.ts";

function requestWithIp(ip: string) {
  return new Request("https://example.com", {
    headers: { "x-forwarded-for": ip },
  });
}

test("limitRequestByIp allows requests under the limit", () => {
  const bucket = `unit-test-${Date.now()}-allow`;
  const first = limitRequestByIp(requestWithIp("203.0.113.1"), bucket, 2, 60_000);
  const second = limitRequestByIp(requestWithIp("203.0.113.1"), bucket, 2, 60_000);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
});

test("limitRequestByIp blocks after the limit is exceeded", () => {
  const bucket = `unit-test-${Date.now()}-block`;
  limitRequestByIp(requestWithIp("203.0.113.2"), bucket, 1, 60_000);
  const blocked = limitRequestByIp(requestWithIp("203.0.113.2"), bucket, 1, 60_000);
  assert.equal(blocked.ok, false);
  assert.match(blocked.error ?? "", /Too many attempts/i);
});

test("limitRequestByIp isolates buckets and client IPs", () => {
  const bucket = `unit-test-${Date.now()}-isolate`;
  limitRequestByIp(requestWithIp("203.0.113.3"), bucket, 1, 60_000);
  const otherIp = limitRequestByIp(requestWithIp("203.0.113.4"), bucket, 1, 60_000);
  const otherBucket = limitRequestByIp(
    requestWithIp("203.0.113.3"),
    `${bucket}-other`,
    1,
    60_000,
  );
  assert.equal(otherIp.ok, true);
  assert.equal(otherBucket.ok, true);
});
