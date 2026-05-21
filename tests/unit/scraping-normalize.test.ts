import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalizePostingUrl,
  contentHash,
  inferSeason,
  isTargetEngineeringInternshipRole,
  normalizeLocations,
  normalizeRoleName,
} from "../../lib/scraping/normalize.ts";
import { parseJaneStreetJobs } from "../../lib/scraping/adapters/jane-street.ts";

test("canonicalizePostingUrl removes tracking params and stable fragments", () => {
  assert.equal(
    canonicalizePostingUrl("https://www.janestreet.com/join-jane-street/position/123/?utm_source=x#apply"),
    "https://www.janestreet.com/join-jane-street/position/123",
  );
});

test("normalizeRoleName keeps the role useful while stripping season noise", () => {
  assert.equal(
    normalizeRoleName("Software Engineer Intern - Summer 2027"),
    "Software Engineer Intern",
  );
});

test("inferSeason reads common internship season and year wording", () => {
  assert.deepEqual(inferSeason("Quantitative Trading Internship, Summer 2027"), {
    season: "Summer",
    seasonYear: 2027,
    seasonSource: "title",
  });
});

test("inferSeason derives season from internship month ranges", () => {
  assert.deepEqual(
    inferSeason("Software Engineer Internship", "This 2026 internship runs May-August."),
    {
      season: "Summer",
      seasonYear: 2026,
      seasonSource: "description",
    },
  );
  assert.deepEqual(
    inferSeason(
      "Software Engineer Internship, Android",
      "12 or 16-week Summer Program (May 2026 - August 2026)",
    ),
    {
      season: "Summer",
      seasonYear: 2026,
      seasonSource: "description",
    },
  );
  assert.deepEqual(
    inferSeason("Software Engineer Internship", "Program dates: September through November 2026."),
    {
      season: "Fall",
      seasonYear: 2026,
      seasonSource: "description",
    },
  );
  assert.deepEqual(
    inferSeason("Software Engineer Internship", "This role runs December to February."),
    {
      season: "Winter",
      seasonYear: null,
      seasonSource: "description",
    },
  );
});

test("normalizeLocations trims duplicate locations and detects remote", () => {
  assert.deepEqual(normalizeLocations([" New York, NY ", "Remote", "New York, NY"]), {
    locations: ["New York, NY", "Remote"],
    countries: ["US"],
    isRemote: true,
    locationRaw: "New York, NY · Remote",
  });
});

test("contentHash is stable for equivalent normalized payloads", () => {
  const first = contentHash({
    roleName: "Software Engineer Intern",
    locations: ["New York, NY", "Remote"],
    season: "Summer",
    seasonYear: 2027,
    postingUrl: "https://example.com/jobs/123?utm_source=a",
  });
  const second = contentHash({
    seasonYear: 2027,
    postingUrl: "https://example.com/jobs/123?utm_source=b",
    season: "Summer",
    locations: ["Remote", "New York, NY"],
    roleName: "Software Engineer Intern",
  });

  assert.equal(first, second);
});

test("isTargetEngineeringInternshipRole keeps engineering and quant internships only", () => {
  assert.equal(isTargetEngineeringInternshipRole("Software Engineer Intern"), true);
  assert.equal(isTargetEngineeringInternshipRole("Quantitative Trading Internship"), true);
  assert.equal(isTargetEngineeringInternshipRole("Machine Learning Engineer", "Internship"), true);
  assert.equal(isTargetEngineeringInternshipRole("Software Engineer", "Summer Internship (December-February)"), true);
  assert.equal(isTargetEngineeringInternshipRole("Quantitative Researcher", "Winter Internship"), true);
  assert.equal(isTargetEngineeringInternshipRole("Quantitative Trader", "Fall Co-Op"), true);
  assert.equal(isTargetEngineeringInternshipRole("Field Sales Intern"), false);
  assert.equal(isTargetEngineeringInternshipRole("Communications Intern"), false);
  assert.equal(isTargetEngineeringInternshipRole("Legal Intern"), false);
  assert.equal(isTargetEngineeringInternshipRole("Product Manager Intern"), false);
  assert.equal(isTargetEngineeringInternshipRole("Strategy and Product", "Winter Internship"), false);
  assert.equal(isTargetEngineeringInternshipRole("IT Operations Engineer", "Summer Internship"), false);
  assert.equal(isTargetEngineeringInternshipRole("Software Engineer - Summer 2027"), false);
  assert.equal(isTargetEngineeringInternshipRole("Software Engineer, New Grad"), false);
});

test("isTargetEngineeringInternshipRole does not infer internship from deep job descriptions", () => {
  const longDescription = `${"About the role. ".repeat(30)}We also run internships for students.`;
  assert.equal(isTargetEngineeringInternshipRole("Software Engineer", longDescription), false);
});

test("parseJaneStreetJobs normalizes visible internship JSON rows", () => {
  const postings = parseJaneStreetJobs(
    [
      {
        id: 123,
        position: "Software Engineer Intern",
        availability: "Internship",
        city: "NYC",
        duration: "June-September",
        category: "Technology",
        team: "Software Engineering",
      },
      {
        id: 789,
        position: "Software Engineer",
        availability: "Summer Internship (December-February)",
        city: "NYC",
        duration: "December-February",
        category: "Technology",
        team: "Software Engineering",
      },
      {
        id: 456,
        position: "ASIC Engineer",
        availability: "Full-Time: Experienced",
        city: "LDN",
        duration: "Permanent",
      },
      {
        id: 999,
        position: "Strategy and Product",
        availability: "Winter Internship",
        city: "NYC",
        duration: "January-March",
      },
    ],
    new Set(["123", "789", "456", "999"]),
  );

  assert.equal(postings.length, 2);
  assert.equal(postings[0].roleName, "Software Engineer");
  assert.equal(postings[0].postingUrl, "https://www.janestreet.com/join-jane-street/position/789/");
  assert.equal(postings[1].roleName, "Software Engineer Intern");
  assert.equal(postings[1].postingUrl, "https://www.janestreet.com/join-jane-street/position/123/");
  assert.deepEqual(postings[0].locations, ["New York"]);
  assert.deepEqual(postings[0].countries, ["US"]);
  assert.equal(postings[0].metadata?.availability, "Summer Internship (December-February)");
});
