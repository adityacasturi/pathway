import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAsmlPostingUrl,
  formatAsmlLocation,
  isAsmlListCandidate,
  parseAsmlJobs,
  parseAsmlNextDataPayload,
  parseAsmlSitemap,
  resolveAsmlBoard,
} from "../../lib/scraping/adapters/asml.ts";
import type { CompanySourceConfig } from "../../lib/scraping/types.ts";

const source: CompanySourceConfig = {
  id: "source-asml",
  companyId: "company-asml",
  companyName: "ASML",
  companySlug: "asml",
  sourceType: "asml",
  adapterKey: "asml",
  sourceUrl: "https://www.asml.com/en/careers/find-your-job",
  boardToken: null,
  lastFetchedCount: null,
};

test("resolveAsmlBoard uses ASML careers defaults", () => {
  const board = resolveAsmlBoard(source);
  assert.equal(board.careersUrl, "https://www.asml.com/en/careers/find-your-job");
  assert.equal(board.sitemapUrl, "https://www.asml.com/api/job-posting-sitemap");
});

test("parseAsmlSitemap extracts career detail URLs", () => {
  const urls = parseAsmlSitemap(`
    <urlset>
      <url><loc>https://www.asml.com/en/careers/find-your-job/software-intern-j001</loc></url>
      <url><loc>https://www.asml.com/en/about</loc></url>
    </urlset>
  `);
  assert.deepEqual(urls, ["https://www.asml.com/en/careers/find-your-job/software-intern-j001"]);
});

test("isAsmlListCandidate matches internship slugs", () => {
  assert.equal(
    isAsmlListCandidate(
      "https://www.asml.com/en/careers/find-your-job/software-engineering-internship-j001",
    ),
    true,
  );
  assert.equal(
    isAsmlListCandidate("https://www.asml.com/en/careers/find-your-job/senior-engineer-j001"),
    false,
  );
});

test("formatAsmlLocation prefers explicit location", () => {
  assert.equal(formatAsmlLocation({ location: "Veldhoven, Netherlands" }), "Veldhoven, Netherlands");
  assert.equal(
    formatAsmlLocation({ city: "San Diego", state: "CA", country: "United States" }),
    "San Diego, CA, United States",
  );
});

test("parseAsmlNextDataPayload returns open jobs only", () => {
  const open = parseAsmlNextDataPayload(
    {
      props: {
        pageProps: {
          jobData: {
            displayJobTitle: "Software Intern",
            status: "Open",
            jobType: "Internship",
          },
        },
      },
    },
    "https://www.asml.com/en/careers/find-your-job/software-intern-j001",
  );
  assert.equal(open?.job.displayJobTitle, "Software Intern");

  const closed = parseAsmlNextDataPayload(
    {
      props: {
        pageProps: {
          jobData: {
            displayJobTitle: "Software Intern",
            status: "Closed",
          },
        },
      },
    },
    "https://www.asml.com/en/careers/find-your-job/software-intern-j001",
  );
  assert.equal(closed, null);
});

test("parseAsmlJobs keeps internships and rejects permanent roles", () => {
  const result = parseAsmlJobs(
    [
      {
        postingUrl: "https://www.asml.com/en/careers/find-your-job/software-intern-j001",
        job: {
          displayJobTitle: "Software Engineering Intern",
          status: "Open",
          jobType: "Internship",
          location: "San Diego, CA, United States",
          datePosted: "2026-01-15T00:00:00",
          descriptionExternal: "<p>Summer internship on the platform team.</p>",
        },
      },
      {
        postingUrl: "https://www.asml.com/en/careers/find-your-job/senior-engineer-j002",
        job: {
          displayJobTitle: "Senior Software Engineer",
          status: "Open",
          jobType: "Regular",
          location: "Veldhoven, Netherlands",
          descriptionExternal: "<p>Experienced hire role.</p>",
        },
      },
    ],
    source,
    2,
  );

  assert.equal(result.stats.fetched, 2);
  assert.equal(result.roles.length, 1);
  assert.equal(result.roles[0]?.roleName, "Software Engineering Intern");
  assert.equal(
    result.roles[0]?.postingUrl,
    "https://www.asml.com/en/careers/find-your-job/software-intern-j001",
  );
});

test("buildAsmlPostingUrl prefers detail page URL when present", () => {
  assert.equal(
    buildAsmlPostingUrl("https://www.asml.com/en/careers/find-your-job/foo", {
      detailPageUrl: "https://www.asml.com/en/careers/find-your-job/foo",
    }),
    "https://www.asml.com/en/careers/find-your-job/foo",
  );
});
