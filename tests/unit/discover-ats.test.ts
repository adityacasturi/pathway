import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAtsFromHtml } from "../../lib/scraping/discover-ats.ts";

describe("parseAtsFromHtml", () => {
  it("extracts Greenhouse board token from embed URL", () => {
    const html = `
      <script src="https://boards.greenhouse.io/embed/job_board/js/acme-corp"></script>
    `;
    const result = parseAtsFromHtml(html, "https://careers.example.com", "acme-corp");
    assert.equal(result?.tier, "greenhouse");
    assert.equal(result?.boardToken, "acme-corp");
    assert.equal(result?.adapterKey, "acme-corp-greenhouse");
  });

  it("extracts Lever board token from jobs link", () => {
    const html = `<a href="https://jobs.lever.co/spotify">Jobs</a>`;
    const result = parseAtsFromHtml(html, "https://lifeatspotify.com/jobs", "spotify");
    assert.equal(result?.tier, "lever");
    assert.equal(result?.boardToken, "spotify");
  });

  it("extracts Ashby board token", () => {
    const html = `Apply at https://jobs.ashbyhq.com/openai`;
    const result = parseAtsFromHtml(html, "https://openai.com/careers", "openai");
    assert.equal(result?.tier, "ashby");
    assert.equal(result?.boardToken, "openai");
  });

  it("extracts Ashby board token from ashbyhq.com path", () => {
    const html = `<a href="https://jobs.ashbyhq.com/snowflake/123">Role</a>`;
    const result = parseAtsFromHtml(html, "https://careers.snowflake.com/search", "snowflake");
    assert.equal(result?.tier, "ashby");
    assert.equal(result?.boardToken, "snowflake");
  });

  it("returns null when no known ATS markers exist", () => {
    const result = parseAtsFromHtml("<html><body>Workday careers</body></html>", "https://x.com", "x");
    assert.equal(result, null);
  });
});
