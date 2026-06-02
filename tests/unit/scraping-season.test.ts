import assert from "node:assert/strict";
import test from "node:test";
import { inferSeason } from "../../lib/scraping/season.ts";

test("inferSeason reads season from title with year", () => {
  assert.equal(
    inferSeason("Tech Ops Engineer Intern - Fall 2026, US"),
    "Fall",
  );
});

test("inferSeason reads season from employment metadata hints", () => {
  assert.equal(
    inferSeason("Software Engineering Intern", "", {
      employmentType: "Internship_non-exempt",
      commitment: "Summer 2025",
    }),
    "Summer",
  );
});

test("inferSeason defaults to Summer when no season signal", () => {
  assert.equal(inferSeason("Backend Engineering Intern"), "Summer");
});
