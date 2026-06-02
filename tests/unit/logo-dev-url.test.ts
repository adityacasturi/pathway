import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildLogoDevImageUrl,
  resolveLogoDevTarget,
} from "../../lib/logo/logo-dev-url.ts";

test("resolveLogoDevTarget prefers website domain", () => {
  assert.deepEqual(resolveLogoDevTarget("Stripe", "https://www.stripe.com/jobs"), {
    domain: "stripe.com",
  });
});

test("buildLogoDevImageUrl builds domain and name endpoints", () => {
  const domainUrl = buildLogoDevImageUrl({ domain: "stripe.com" }, "pk_test", 128);
  assert.ok(domainUrl?.includes("img.logo.dev/stripe.com"));
  assert.ok(domainUrl?.includes("token=pk_test"));

  const nameUrl = buildLogoDevImageUrl({ company: "Jane Street" }, "pk_test", 128);
  assert.ok(nameUrl?.includes("img.logo.dev/name/Jane%20Street"));
});
