import assert from "node:assert/strict";
import test from "node:test";
import {
  extractAvatureDetailDatePosted,
  extractJsonLdDatePosted,
} from "../../lib/scraping/avature-dates.ts";

test("extractJsonLdDatePosted reads JobPosting datePosted", () => {
  const html = `<script type="application/ld+json">{"datePosted":"2026-5-28"}</script>`;
  assert.equal(extractJsonLdDatePosted(html), "2026-5-28");
});

test("extractAvatureDetailDatePosted prefers JSON-LD over sidebar", () => {
  const html = `
    <script type="application/ld+json">{"datePosted":"2026-03-01"}</script>
    <div class="job-description__desc-job-info job-date">
      <p class="job-description__desc-detail">March 10, 2026</p>
    </div>`;
  assert.equal(extractAvatureDetailDatePosted(html), "2026-03-01");
});
