import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDirectCareersUrls,
  buildDomainCandidates,
  extractCareerLinksFromHtml,
  pickBestCareerLink,
  scoreCareerPath,
} from "../../lib/scraping/discover-careers.ts";

describe("buildDomainCandidates", () => {
  it("includes slug, compact, and careers subdomains", () => {
    const domains = buildDomainCandidates("cockroach-labs");
    assert.ok(domains.includes("cockroachlabs.com"));
    assert.ok(domains.includes("careers.cockroach-labs.com"));
  });

  it("honors explicit domain hint", () => {
    const domains = buildDomainCandidates("block", "block.xyz");
    assert.ok(domains.includes("block.xyz"));
    assert.ok(domains.includes("careers.block.xyz"));
  });
});

describe("extractCareerLinksFromHtml", () => {
  it("finds careers links on a homepage", () => {
    const html = `
      <a href="/about">About</a>
      <a href="https://careers.example.com/jobs">Careers</a>
      <a href="https://www.linkedin.com/company/example">LinkedIn</a>
    `;
    const links = extractCareerLinksFromHtml(html, "https://www.example.com");
    assert.equal(links.length, 1);
    assert.equal(links[0]?.url, "https://careers.example.com/jobs");
  });

  it("prefers higher-scored paths", () => {
    const links = [
      { url: "https://acme.com/about", label: "About", score: 0 },
      { url: "https://acme.com/careers", label: "Careers", score: 6 },
    ];
    const best = pickBestCareerLink(links, "acme.com");
    assert.equal(best?.url, "https://acme.com/careers");
  });
});

describe("scoreCareerPath", () => {
  it("scores career and job paths", () => {
    assert.ok(scoreCareerPath("/company/careers") > scoreCareerPath("/press"));
    assert.ok(scoreCareerPath("/jobs") > 0);
  });
});

describe("buildDirectCareersUrls", () => {
  it("generates careers subdomain URLs first", () => {
    const urls = buildDirectCareersUrls(["careers.snowflake.com", "snowflake.com"]);
    assert.ok(urls.some((url) => url.startsWith("https://careers.snowflake.com")));
    assert.ok(urls.some((url) => url.includes("snowflake.com/careers")));
  });
});
