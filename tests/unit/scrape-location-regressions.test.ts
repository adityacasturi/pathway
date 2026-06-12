import assert from "node:assert/strict";
import test from "node:test";
import { inferCitadelLocations } from "../../lib/scraping/adapters/citadel.ts";
import { inferIbmLocation } from "../../lib/scraping/adapters/ibm.ts";
import { parseSeagateSearchHtml, resolveSeagateBoard } from "../../lib/scraping/adapters/seagate.ts";
import { canonicalizePostingUrl } from "../../lib/scraping/posting-url.ts";
import { resolveScrapedLocations } from "../../lib/geo/server.ts";

test("citadel europe slug suffix maps to a resolvable tier-1 office", () => {
  const locations = inferCitadelLocations("software-engineer-intern-europe");
  const resolved = resolveScrapedLocations(locations);
  assert.deepEqual(resolved.countries, ["GB"]);
  assert.match(resolved.display ?? "", /London/);
});

test("ibm card facets are never mistaken for locations", () => {
  assert.equal(inferIbmLocation(["Internship", "Entry Level"]), null);
  assert.equal(inferIbmLocation(["Professional"]), null);
  assert.equal(inferIbmLocation(["Administration & Technician"]), null);
  assert.equal(
    inferIbmLocation(["Internship", "Entry Level", "Bangalore, India"]),
    "Bangalore, India",
  );
});

test("seagate tile regex captures the location value, not the label", () => {
  // Mirrors live seagatecareers.com markup: the label's aria-describedby ends
  // with "section-location-value", which the old regex matched first.
  const html = `
    <li class="job-tile job-id-123" data-url="/job/Singapore-Intern/123/">
      <a class="jobTitle-link" href="/job/Singapore-Intern/123/">Engineering Intern</a>
      <span id="job-123-desktop-section-location-label"
            aria-describedby="job-123-desktop-section-location-value"
            class="section-label">Location</span>
      <span id="job-123-desktop-section-location-value">Singapore, SG</span>
    </li>`;
  const board = resolveSeagateBoard({
    id: "x",
    companyId: "x",
    companySlug: "seagate",
    companyName: "Seagate",
    sourceType: "seagate",
    adapterKey: "seagate",
    sourceUrl: "https://seagatecareers.com/search/",
    boardToken: null,
  });
  const jobs = parseSeagateSearchHtml(html, board);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]!.location, "Singapore, SG");
});

test("posting URL canonicalization is stable across param order", () => {
  const a = canonicalizePostingUrl("https://jobs.example.com/job?id=1&dept=eng");
  const b = canonicalizePostingUrl("https://jobs.example.com/job?dept=eng&id=1");
  assert.equal(a, b);
});
