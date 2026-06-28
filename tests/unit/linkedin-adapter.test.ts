import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLinkedInPostingUrl,
  parseLinkedInJobPostingHtml,
  parseLinkedInSearchSummaries,
  shouldPrefetchLinkedInDetail,
} from "@/lib/scraping/adapters/linkedin";

test("shouldPrefetchLinkedInDetail rejects infrastructure false positives from broad search", () => {
  assert.equal(
    shouldPrefetchLinkedInDetail({
      jobId: "4430749190",
      title: "Staff Software Engineer",
      postingUrl: buildLinkedInPostingUrl("4430749190", "Staff Software Engineer"),
    }),
    false,
  );
  assert.equal(
    shouldPrefetchLinkedInDetail({
      jobId: "4429153359",
      title: "Sr Software Engineer Systems Infrastructure",
      postingUrl: buildLinkedInPostingUrl("4429153359", "Sr Software Engineer Systems Infrastructure"),
    }),
    false,
  );
  assert.equal(
    shouldPrefetchLinkedInDetail({
      jobId: "123",
      title: "Software Engineer Intern - Summer 2026",
      postingUrl: buildLinkedInPostingUrl("123", "Software Engineer Intern - Summer 2026"),
    }),
    true,
  );
});

test("parseLinkedInSearchSummaries extracts job ids and titles from search HTML", () => {
  const html = `
    <li data-entity-urn="urn:li:jobPosting:9876543210">
      <a href="/jobs/view/software-engineer-intern-at-linkedin-9876543210">Software Engineer Intern</a>
    </li>
  `;
  const summaries = parseLinkedInSearchSummaries(html);
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]?.jobId, "9876543210");
  assert.equal(summaries[0]?.title, "Software Engineer Intern");
});

test("parseLinkedInJobPostingHtml extracts title and criteria from guest posting HTML", () => {
  const html = `
    <h2 class="topcard__title">Software Engineer Intern - Summer 2026</h2>
    <a class="topcard__org-name-link">LinkedIn</a>
    <span class="topcard__flavor">LinkedIn</span>
    <span class="topcard__flavor">Sunnyvale, CA</span>
    <h3 class="description__job-criteria-subheader">Employment type</h3>
    <span class="description__job-criteria-text description__job-criteria-text--criteria">Internship</span>
    <div class="description__text description__text--rich"><p>Build features.</p></div>
  `;
  const detail = parseLinkedInJobPostingHtml(html, "9876543210");
  assert.ok(detail);
  assert.equal(detail?.title, "Software Engineer Intern - Summer 2026");
  assert.equal(detail?.employmentType, "Internship");
  assert.equal(detail?.location, "Sunnyvale, CA");
});
