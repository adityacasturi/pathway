import assert from "node:assert/strict";
import test from "node:test";
import {
  buildIcimsPostingUrl,
  formatIcimsLocation,
  parseIcimsJobs,
  resolveIcimsUrls,
} from "../../lib/scraping/adapters/icims.ts";
import type { CompanySourceConfig } from "../../lib/scraping/types.ts";

const source: CompanySourceConfig = {
  id: "source-docusign",
  companyId: "company-docusign",
  companyName: "DocuSign",
  companySlug: "docusign",
  sourceType: "icims",
  adapterKey: "docusign",
  sourceUrl: "https://careers.docusign.com/careers-home",
  boardToken: null,
  lastFetchedCount: null,
};

test("resolveIcimsUrls splits API origin from careers portal path", () => {
  const { apiBase, boardBase } = resolveIcimsUrls(source);
  assert.equal(apiBase, "https://careers.docusign.com");
  assert.equal(boardBase, "https://careers.docusign.com/careers-home");
});

test("buildIcimsPostingUrl uses slug and language", () => {
  assert.equal(
    buildIcimsPostingUrl("https://careers.docusign.com/careers-home", {
      slug: "29621",
      language: "en-us",
    }),
    "https://careers.docusign.com/careers-home/jobs/29621?lang=en-us",
  );
  assert.equal(buildIcimsPostingUrl("https://careers.docusign.com/careers-home", {}), "");
});

test("formatIcimsLocation prefers full_location and falls back to parts", () => {
  assert.equal(formatIcimsLocation({ full_location: "Dublin, Ireland" }), "Dublin, Ireland");
  assert.equal(
    formatIcimsLocation({ city: "Seattle", state: "WA", country: "United States" }),
    "Seattle, WA, United States",
  );
  assert.equal(formatIcimsLocation({ location_type: "remote" }), "Remote");
  assert.equal(formatIcimsLocation({}), null);
});

test("parseIcimsJobs keeps internships and rejects permanent roles", () => {
  const result = parseIcimsJobs(
    [
      {
        slug: "30001",
        title: "Software Engineer Intern",
        language: "en-us",
        description: "Summer 2026 internship on the platform team.",
        employment_type: "INTERN",
        category: [" Engineering"],
        full_location: "Seattle, WA",
      },
      {
        slug: "29621",
        title: "Market Development Representative (UK/IE Markets)",
        language: "en-us",
        employment_type: "FULL_TIME",
        category: [" Global Sales Development"],
        full_location: "Dublin, Ireland",
      },
    ],
    source,
    "https://careers.docusign.com/careers-home",
  );

  assert.equal(result.stats.fetched, 2);
  assert.equal(result.roles.length, 1);
  assert.equal(result.roles[0]?.roleName, "Software Engineer Intern");
  assert.equal(
    result.roles[0]?.postingUrl,
    "https://careers.docusign.com/careers-home/jobs/30001?lang=en-us",
  );
  assert.equal(result.stats.rejected.length, 1);
});
