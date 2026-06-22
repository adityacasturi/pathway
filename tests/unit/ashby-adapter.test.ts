import assert from "node:assert/strict";
import test from "node:test";

import { parseAshbyJobs, parseAshbyPostingPageUpdatedAt } from "@/lib/scraping/adapters/ashby";
import type { CompanySourceConfig } from "@/lib/scraping/types";

const SOURCE: CompanySourceConfig = {
  id: "source-uuid",
  companyId: "company-uuid",
  companySlug: "ramp",
  companyName: "Ramp",
  sourceType: "ashby",
  adapterKey: "ashby",
  sourceUrl: "https://jobs.ashbyhq.com/ramp",
  boardToken: "ramp",
};

test("parseAshbyJobs preserves publishedAt in ATS dates", () => {
  const parsed = parseAshbyJobs(
    [
      {
        id: "67fadb77-43d8-4449-954b-d4cf2c6d3b8b",
        title: "Software Engineer Internship, Android ",
        jobUrl: "https://jobs.ashbyhq.com/ramp/67fadb77-43d8-4449-954b-d4cf2c6d3b8b",
        descriptionPlain: "Fall Program (August/September 2026 - December 2026)",
        employmentType: "Intern",
        location: "New York, NY",
        publishedAt: "2025-08-07T20:49:38.961+00:00",
        isListed: true,
      },
    ],
    SOURCE,
  );

  assert.equal(parsed.roles.length, 1);
  assert.equal(parsed.roles[0].atsDates?.publishedAt, "2025-08-07T20:49:38.961+00:00");
});

test("parseAshbyPostingPageUpdatedAt reads updatedAt from embedded page data", () => {
  const html = `
    <script>
      window.__appData = {"posting":{"id":"67fadb77-43d8-4449-954b-d4cf2c6d3b8b","updatedAt":"2026-06-04T16:57:38.597Z"}};
    </script>
  `;

  assert.equal(parseAshbyPostingPageUpdatedAt(html), "2026-06-04T16:57:38.597Z");
});
