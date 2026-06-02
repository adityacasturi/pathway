import assert from "node:assert/strict";
import { test } from "node:test";
import {
  logoDevReferer,
  logoProxyStatusFromUpstream,
  isRetryableLogoProxyStatus,
} from "../../lib/logo/upstream.ts";

test("logoProxyStatusFromUpstream maps success and missing logo", () => {
  assert.equal(logoProxyStatusFromUpstream(200), 200);
  assert.equal(logoProxyStatusFromUpstream(404), 404);
});

test("logoProxyStatusFromUpstream maps auth and server errors to retryable 503", () => {
  assert.equal(logoProxyStatusFromUpstream(401), 503);
  assert.equal(logoProxyStatusFromUpstream(403), 503);
  assert.equal(logoProxyStatusFromUpstream(429), 503);
  assert.equal(logoProxyStatusFromUpstream(502), 503);
});

test("isRetryableLogoProxyStatus", () => {
  assert.equal(isRetryableLogoProxyStatus(503), true);
  assert.equal(isRetryableLogoProxyStatus(404), false);
});

test("logoDevReferer prefers NEXT_PUBLIC_SITE_URL", () => {
  const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
  const prevVercel = process.env.VERCEL_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.trypathway.app";
  delete process.env.VERCEL_URL;
  try {
    assert.equal(logoDevReferer(), "https://www.trypathway.app/");
  } finally {
    if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = prevSite;
    if (prevVercel === undefined) delete process.env.VERCEL_URL;
    else process.env.VERCEL_URL = prevVercel;
  }
});
