import assert from "node:assert/strict";
import test from "node:test";

import {
  isShopifyFeedUrl,
  isShopifyListCandidate,
  normalizeShopifyPostingUrl,
  parseShopifyFeedXml,
  parseShopifyJobs,
} from "@/lib/scraping/adapters/shopify";
import type { CompanySourceConfig } from "@/lib/scraping/types";

const source: CompanySourceConfig = {
  id: "source-shopify",
  companyId: "company-shopify",
  companyName: "Shopify",
  companySlug: "shopify",
  sourceType: "shopify",
  adapterKey: "shopify",
  sourceUrl: "https://www.shopify.com/careers/feed.xml",
  boardToken: null,
  lastFetchedCount: null,
};

test("isShopifyFeedUrl accepts the canonical careers feed", () => {
  assert.equal(isShopifyFeedUrl("https://www.shopify.com/careers/feed.xml"), true);
  assert.equal(isShopifyFeedUrl("https://www.shopify.com/careers/feed.xml/"), true);
  assert.equal(isShopifyFeedUrl("https://jobs.shopify.com/feed.xml"), false);
});

test("parseShopifyFeedXml extracts job fields from LinkedIn-style XML", () => {
  const jobs = parseShopifyFeedXml(`
    <jobs>
      <job>
        <title><![CDATA[Software Engineering Intern - Summer 2026]]></title>
        <partnerJobId>12345</partnerJobId>
        <description><![CDATA[<p>Build commerce tools.</p>]]></description>
        <applyUrl>https://www.shopify.com/careers/software-engineering-intern_12345?ref=feed</applyUrl>
        <location>Toronto, ON, Canada</location>
        <workplaceTypes>Hybrid</workplaceTypes>
        <experienceLevel>INTERNSHIP</experienceLevel>
        <listDate>3/15/2026</listDate>
      </job>
    </jobs>
  `);

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]?.title, "Software Engineering Intern - Summer 2026");
  assert.equal(jobs[0]?.partnerJobId, "12345");
  assert.equal(jobs[0]?.location, "Toronto, ON, Canada");
});

test("isShopifyListCandidate keeps internships and rejects unrelated titles", () => {
  assert.equal(
    isShopifyListCandidate({
      title: "Software Engineering Intern - Summer 2026",
      partnerJobId: "1",
      description: null,
      applyUrl: null,
      location: null,
      workplaceTypes: null,
      experienceLevel: "INTERNSHIP",
      listDate: null,
    }),
    true,
  );
  assert.equal(
    isShopifyListCandidate({
      title: "Senior Staff Engineer",
      partnerJobId: "2",
      description: null,
      applyUrl: null,
      location: null,
      workplaceTypes: null,
      experienceLevel: "SENIOR",
      listDate: null,
    }),
    false,
  );
});

test("normalizeShopifyPostingUrl strips query and hash", () => {
  assert.equal(
    normalizeShopifyPostingUrl(
      "https://www.shopify.com/careers/software-engineering-intern_12345?ref=feed#apply",
    ),
    "https://www.shopify.com/careers/software-engineering-intern_12345",
  );
});

test("parseShopifyJobs keeps internships with normalized posting URLs", () => {
  const result = parseShopifyJobs(
    [
      {
        title: "Software Engineering Intern - Summer 2026",
        partnerJobId: "12345",
        description: "<p>Build commerce tools.</p>",
        applyUrl: "https://www.shopify.com/careers/software-engineering-intern_12345?ref=feed",
        location: "Toronto, ON, Canada",
        workplaceTypes: "Hybrid",
        experienceLevel: "INTERNSHIP",
        listDate: "3/15/2026",
      },
    ],
    source,
    1,
  );

  assert.equal(result.roles.length, 1);
  assert.equal(
    result.roles[0]?.postingUrl,
    "https://www.shopify.com/careers/software-engineering-intern_12345",
  );
});
