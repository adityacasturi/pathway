import assert from "node:assert/strict";
import test from "node:test";
import { isProxyPublicBypassPath } from "../../lib/auth/proxy-public-paths.ts";

test("proxy bypasses auth for public static and machine paths", () => {
  for (const pathname of [
    "/auth/confirm",
    "/alerts/unsubscribe",
    "/alerts/unsubscribe?token=ignored",
    "/brand/pathway-logo.png",
    "/school-logos/uw.png",
    "/company-logos/google.png",
    "/api/revalidate-catalog",
    "/favicon.ico",
    "/icon.png",
    "/apple-icon.png",
  ]) {
    assert.equal(isProxyPublicBypassPath(pathname), true, pathname);
  }
});

test("proxy does not bypass auth for protected app and logo proxy paths", () => {
  for (const pathname of [
    "/home",
    "/openings",
    "/companies",
    "/alerts",
    "/settings",
    "/api/logo",
  ]) {
    assert.equal(isProxyPublicBypassPath(pathname), false, pathname);
  }
});
