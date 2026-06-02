import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDiscoverCompanyPlan,
  parseDiscoverCompanyArgs,
} from "../../scripts/discover-company/plan.ts";

test("parseDiscoverCompanyArgs builds a dry-run onboarding plan by default", () => {
  const plan = parseDiscoverCompanyArgs([
    "--slug",
    "acme",
    "--name",
    "Acme",
    "--website",
    "https://acme.example",
    "--careers",
    "https://acme.example/careers",
    "--industry",
    "enterprise-software",
    "--source-type",
    "greenhouse",
    "--source-url",
    "https://job-boards.greenhouse.io/acme",
    "--board-token",
    "acme",
  ]);

  assert.equal(plan.apply, false);
  assert.equal(plan.scrape, false);
  assert.deepEqual(plan.company, {
    slug: "acme",
    name: "Acme",
    website_url: "https://acme.example/",
    careers_url: "https://acme.example/careers",
    industry: "enterprise-software",
    is_active: true,
    logo_asset_key: null,
  });
  assert.deepEqual(plan.source, {
    source_type: "greenhouse",
    adapter_key: "greenhouse",
    source_url: "https://job-boards.greenhouse.io/acme",
    board_token: "acme",
    enabled: true,
    scrape_interval_minutes: 15,
  });
});

test("parseDiscoverCompanyArgs supports apply, scrape, disabled source, and custom adapter key", () => {
  const plan = parseDiscoverCompanyArgs([
    "--slug",
    "acme",
    "--name",
    "Acme",
    "--source-type",
    "workday",
    "--adapter-key",
    "custom-workday",
    "--source-url",
    "https://acme.wd1.myworkdayjobs.com/acme",
    "--disabled",
    "--apply",
    "--scrape",
    "--logo-asset-key",
    "acme",
  ]);

  assert.equal(plan.apply, true);
  assert.equal(plan.scrape, true);
  assert.equal(plan.company.logo_asset_key, "acme");
  assert.equal(plan.source.adapter_key, "custom-workday");
  assert.equal(plan.source.enabled, false);
});

test("buildDiscoverCompanyPlan rejects invalid source types and malformed slugs", () => {
  assert.throws(
    () =>
      buildDiscoverCompanyPlan({
        slug: "Bad Slug",
        name: "Bad",
        sourceType: "greenhouse",
        sourceUrl: "https://job-boards.greenhouse.io/bad",
      }),
    /slug/,
  );

  assert.throws(
    () =>
      buildDiscoverCompanyPlan({
        slug: "acme",
        name: "Acme",
        sourceType: "not-real",
        sourceUrl: "https://example.com/jobs",
      }),
    /source-type/,
  );
});

test("parseDiscoverCompanyArgs requires the fields needed to create a source", () => {
  assert.throws(
    () => parseDiscoverCompanyArgs(["--slug", "acme", "--name", "Acme"]),
    /source-type/,
  );
  assert.throws(
    () =>
      parseDiscoverCompanyArgs([
        "--slug",
        "acme",
        "--name",
        "Acme",
        "--source-type",
        "greenhouse",
      ]),
    /source-url/,
  );
});
