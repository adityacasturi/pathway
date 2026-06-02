import assert from "node:assert/strict";
import test from "node:test";
import {
  lookupCompanySlug,
  lookupCompanyWebsiteUrl,
} from "../../lib/logo/company-website-lookup.ts";

test("lookupCompanyWebsiteUrl prefers explicit website", () => {
  const url = lookupCompanyWebsiteUrl(
    "Stripe",
    { stripe: "https://stripe.com" },
    { explicit: "https://example.com" },
  );
  assert.equal(url, "https://example.com");
});

test("lookupCompanyWebsiteUrl resolves by normalized company name", () => {
  const url = lookupCompanyWebsiteUrl("  Point72  ", {
    point72: "https://point72.com",
  });
  assert.equal(url, "https://point72.com");
});

test("lookupCompanyWebsiteUrl resolves by slug when lookups include bySlug", () => {
  const url = lookupCompanyWebsiteUrl(
    "Unknown Label",
    {
      bySlug: new Map([["google", "https://google.com"]]),
      byName: new Map(),
      slugByName: new Map(),
      logoAssetByName: new Map(),
    },
    { slug: "google" },
  );
  assert.equal(url, "https://google.com");
});

test("lookupCompanySlug resolves catalog slug by normalized company name", () => {
  const slug = lookupCompanySlug("  Goldman Sachs  ", {
    "goldman sachs": "goldman-sachs",
  });
  assert.equal(slug, "goldman-sachs");
});
