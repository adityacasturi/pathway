import assert from "node:assert/strict";
import test from "node:test";

import nextConfig from "../../next.config.ts";

test("company logo static assets have durable browser cache headers", async () => {
  const headersFn = nextConfig.headers;
  assert.equal(typeof headersFn, "function");
  assert.ok(headersFn);

  const headers = await headersFn();
  const companyLogoRoute = headers.find((entry) => entry.source === "/company-logos/:path*");

  assert.ok(companyLogoRoute);
  assert.deepEqual(companyLogoRoute.headers, [
    {
      key: "Cache-Control",
      value: "public, max-age=604800, stale-while-revalidate=2592000",
    },
  ]);
});
