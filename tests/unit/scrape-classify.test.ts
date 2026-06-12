import assert from "node:assert/strict";
import test from "node:test";
import { classifyScrapeRole } from "../../lib/scraping/classify-role.ts";

// --- True positives -----------------------------------------------------------

test("includes engineering internships by title", () => {
  const result = classifyScrapeRole({
    title: "Forward Deployed Software Engineer, Internship - US Government",
    commitment: "Internship",
    locations: ["Washington, D.C."],
  });

  assert.equal(result.include, true);
  assert.equal(result.reason, "included");
  assert.equal(result.roleType, "internship");
  assert.ok(result.signals.includes("title:student_opportunity"));
});

test("includes non-US engineering internships", () => {
  const result = classifyScrapeRole({
    title: "Forward Deployed Software Engineer, Internship - France",
    commitment: "Internship",
    locations: ["Paris, France"],
  });

  assert.equal(result.include, true);
});

test("includes co-ops and types them as co_op", () => {
  const result = classifyScrapeRole({
    title: "Software Engineering Co-op, Fall 2026",
    locations: ["Boston, MA"],
  });

  assert.equal(result.include, true);
  assert.equal(result.roleType, "co_op");
});

test("includes summer analyst engineering programs", () => {
  const result = classifyScrapeRole({
    title: "Technology - Software Development, Summer Analyst, 2026",
    locations: ["New York, New York, United States"],
    departments: ["Operations & Technology", "Technology", "Internship"],
  });

  assert.equal(result.include, true);
});

test("includes intern signal from employment metadata when title is plain", () => {
  const result = classifyScrapeRole({
    title: "Software Engineer, Android",
    employmentType: "Intern",
    team: "Emerging Talent - SWE",
    locations: ["New York, NY (HQ)", "San Francisco, CA"],
  });

  assert.equal(result.include, true);
  assert.ok(result.signals.includes("metadata:employment_type"));
});

test("includes roles with no parseable location (location does not gate relevance)", () => {
  const result = classifyScrapeRole({
    title: "Software Engineer, Intern",
    locations: [],
  });

  assert.equal(result.include, true);
  assert.equal(result.reason, "included");
});

test("includes working student / industrial placement titles", () => {
  const result = classifyScrapeRole({
    title: "Working Student - Backend Development",
    locations: ["Munich, Germany"],
  });

  assert.equal(result.include, true);
});

// --- False positives that must be rejected -------------------------------------

test("rejects leveled full-time roles even when the description mentions interns", () => {
  const result = classifyScrapeRole({
    title: "Hardware Engineer II",
    description: "Our team also hosts a summer internship program for students.",
    locations: ["Santa Clara, CA"],
  });

  assert.equal(result.include, false);
  assert.equal(result.reason, "senior_level_role");
  assert.ok(result.signals.includes("negative:leveled_title"));
});

test("rejects senior titles with weak (description-only) intern signals", () => {
  const result = classifyScrapeRole({
    title: "Senior Software Engineer",
    description: "Mentor interns in our internship program.",
    locations: ["Seattle, WA"],
  });

  assert.equal(result.include, false);
  assert.equal(result.reason, "senior_level_role");
  assert.ok(result.signals.includes("negative:seniority_title"));
});

test("rejects staff/principal/manager titles without student signals", () => {
  for (const title of [
    "Staff Software Engineer",
    "Principal Engineer, Infrastructure",
    "Engineering Manager, Payments",
  ]) {
    const result = classifyScrapeRole({ title, locations: ["Denver, CO"] });
    assert.equal(result.include, false, title);
  }
});

test("rejects plain full-time roles with no student signal anywhere", () => {
  const result = classifyScrapeRole({
    title: "Software Engineer, Backend",
    employmentType: "Full Time",
    locations: ["Austin, TX"],
  });

  assert.equal(result.include, false);
  assert.equal(result.reason, "no_student_signal");
});

test("rejects new grad roles while new-grad support is off", () => {
  for (const title of [
    "Software Engineer - New Grad",
    "Entry Level Software Engineer",
    "Software Engineer, Entry-Level",
  ]) {
    const result = classifyScrapeRole({
      title,
      departments: ["University"],
      locations: ["San Francisco, CA"],
    });
    assert.equal(result.include, false, title);
    assert.equal(result.reason, "new_grad_excluded", title);
    assert.equal(result.roleType, "new_grad", title);
  }
});

test("rejects early-career full-time titles (often new grad, not intern)", () => {
  for (const title of ["Early Career Software Engineer", "Software Engineer, Early Career"]) {
    const result = classifyScrapeRole({ title, locations: ["Costa Mesa, CA"] });
    assert.equal(result.include, false, title);
    assert.equal(result.reason, "no_student_signal", title);
  }
});

test("rejects Internal/International/Internet false positives", () => {
  for (const title of [
    "Internal Audit Lead, Merchant Acquirer Limited Purpose Bank (MALPB)",
    "International Tax Engineer",
    "Internet Services Engineer",
  ]) {
    const result = classifyScrapeRole({ title, locations: ["San Francisco, CA"] });
    assert.equal(result.include, false, title);
    assert.equal(result.reason, "title_false_positive", title);
  }
});

test("rejects non-engineering internships", () => {
  const result = classifyScrapeRole({
    title: "Deployment Strategist, Internship",
    commitment: "Internship",
    locations: ["New York, NY"],
  });

  assert.equal(result.include, false);
  assert.equal(result.reason, "non_engineering_role");
});

test("rejects permanent employment metadata with weak intern signals", () => {
  const result = classifyScrapeRole({
    title: "Software Engineer",
    employmentType: "Permanent",
    description: "You may collaborate with our internship cohort.",
    locations: ["London, United Kingdom"],
  });

  assert.equal(result.include, false);
  assert.equal(result.reason, "senior_level_role");
  assert.ok(result.signals.includes("negative:permanent_employment_type"));
});

// --- Explainability -------------------------------------------------------------

test("classification carries raw location inputs through unchanged", () => {
  const result = classifyScrapeRole({
    title: "Software Engineering Intern",
    locations: ["Tel Aviv District, IL"],
    structuredLocations: [{ rawLabel: "Remote", remote: true }],
  });

  assert.deepEqual(result.locations, ["Tel Aviv District, IL"]);
  assert.equal(result.structuredLocations.length, 1);
});

test("every decision exposes machine-readable signals", () => {
  const included = classifyScrapeRole({
    title: "Machine Learning Intern",
    locations: ["Zurich, Switzerland"],
  });
  assert.ok(included.signals.length > 0);

  const rejectedRole = classifyScrapeRole({
    title: "Director of Engineering",
    description: "Oversee our internship program.",
    locations: ["Chicago, IL"],
  });
  assert.equal(rejectedRole.include, false);
  assert.ok(rejectedRole.signals.some((signal) => signal.startsWith("negative:")));
});
