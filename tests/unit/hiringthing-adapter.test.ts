import assert from "node:assert/strict";
import test from "node:test";

import {
  parseVoloridgeJobDetailHtml,
  parseVoloridgeListHtml,
} from "@/lib/scraping/adapters/hiringthing";

test("parseVoloridgeListHtml extracts internship opportunities from current careers page", () => {
  const html = `
    <h2>Internship Opportunities</h2>
    <a href="/jobs/voloridgeinvestmentmanagement/4224862009"> Quantitative Developer Intern 2027 </a>
    <a href="/jobs/voloridgeinvestmentmanagement/4224950009"> Quantitative Research Fellowship 2027 </a>
    <a href="/jobs/voloridgeinvestmentmanagement/4226247009"> Quantitative Research Intern 2027 </a>
    <h2>Career Opportunities</h2>
    <a href="/jobs/voloridgeinvestmentmanagement/4220000009"> IT Support Administrator </a>
  `;

  const jobs = parseVoloridgeListHtml(html);

  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      "Quantitative Developer Intern 2027",
      "Quantitative Research Fellowship 2027",
      "Quantitative Research Intern 2027",
    ],
  );
  assert.equal(
    jobs[0]?.listUrl,
    "https://voloridge.com/jobs/voloridgeinvestmentmanagement/4224862009",
  );
});

test("parseVoloridgeJobDetailHtml extracts title and location", () => {
  const detail = parseVoloridgeJobDetailHtml(
    `
      <h2>Quantitative Developer Intern 2027</h2>
      <p>Voloridge Investment Management — Jupiter, FL</p>
      <p>We are seeking a Quantitative Developer Intern to join our talented development team.</p>
    `,
    "Quantitative Developer Intern 2027",
  );

  assert.equal(detail.title, "Quantitative Developer Intern 2027");
  assert.equal(detail.location, "Jupiter, FL");
  assert.match(detail.description, /Quantitative Developer Intern/);
});
