import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDisneyPostingUrl,
  buildDisneySearchUrl,
  isDisneyJobPath,
  parseDisneySearchJobsHtml,
  resolveDisneyBoard,
} from "../../lib/scraping/adapters/disney.ts";
import type { CompanySourceConfig } from "../../lib/scraping/types.ts";

const disneySource: CompanySourceConfig = {
  id: "source-disney",
  companyId: "company-disney",
  companyName: "The Walt Disney Company",
  companySlug: "disney",
  sourceType: "disney",
  adapterKey: "disney-talentbrew",
  sourceUrl: "https://www.disneycareers.com/en/search-jobs?k=intern",
  boardToken: "intern",
  lastFetchedCount: null,
};

test("isDisneyJobPath accepts TalentBrew job paths", () => {
  assert.equal(
    isDisneyJobPath("/en/job/lisbon/scheduling-intern/391/96458291792"),
    true,
  );
  assert.equal(isDisneyJobPath("/en/search-jobs"), false);
});

test("buildDisneyPostingUrl canonicalizes relative paths", () => {
  assert.equal(
    buildDisneyPostingUrl(
      "https://www.disneycareers.com",
      "/en/job/lisbon/scheduling-intern/391/96458291792",
    ),
    "https://www.disneycareers.com/en/job/lisbon/scheduling-intern/391/96458291792",
  );
});

test("parseDisneySearchJobsHtml extracts title and location", () => {
  const html = `
    <a href="/en/job/lisbon/scheduling-intern/391/96458291792" data-job-id="96458291792">
      <h2>Scheduling Intern</h2>
      <span class="job-brand">The Walt Disney Company (EMEA)</span>
      <span class="job-location">Lisbon,  Portugal</span>
    </a>
  `;
  const listings = parseDisneySearchJobsHtml(html, "https://www.disneycareers.com");
  assert.equal(listings.length, 1);
  assert.equal(listings[0]?.title, "Scheduling Intern");
  assert.equal(listings[0]?.location, "Lisbon, Portugal");
});

test("resolveDisneyBoard normalizes search keyword from source url", () => {
  const board = resolveDisneyBoard({
    ...disneySource,
    sourceUrl: "https://www.disneycareers.com/en/search-jobs?k=engineering+intern",
    boardToken: "engineering intern",
  });
  assert.equal(board.searchKeyword, "engineering intern");
  assert.equal(
    board.searchUrl,
    "https://www.disneycareers.com/en/search-jobs?k=engineering+intern",
  );
});

test("buildDisneySearchUrl adds pagination", () => {
  assert.equal(
    buildDisneySearchUrl("https://www.disneycareers.com", "intern", 2),
    "https://www.disneycareers.com/en/search-jobs?k=intern&p=2",
  );
});
