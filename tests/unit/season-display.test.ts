import assert from "node:assert/strict";
import test from "node:test";
import { inferSeason } from "../../lib/scraping/normalize.ts";
import { resolveDisplaySeason } from "../../lib/postings/season.ts";

test("resolveDisplaySeason strips years and defaults unknown values to Summer", () => {
  assert.equal(resolveDisplaySeason("Summer 2026"), "Summer");
  assert.equal(resolveDisplaySeason("Fall 2027"), "Fall");
  assert.equal(resolveDisplaySeason("Unknown"), "Summer");
  assert.equal(resolveDisplaySeason("Year-round"), "Summer");
});

test("inferSeason defaults ambiguous postings to Summer", () => {
  assert.deepEqual(inferSeason("Software Engineer Intern", "Join our team."), {
    season: "Summer",
    seasonYear: null,
    seasonSource: "unknown",
  });
});
