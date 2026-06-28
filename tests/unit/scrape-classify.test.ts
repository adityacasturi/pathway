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

test("includes programming-language rendering internships", () => {
  const result = classifyScrapeRole({
    title: "Rendering SE Intern - C++",
    locations: ["Vancouver, Canada"],
  });

  assert.equal(result.include, true);
  assert.equal(result.reason, "included");
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
    "Software Engineer Grad",
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

test("rejects metadata-only intern employment on non-engineering titles", () => {
  const result = classifyScrapeRole({
    title: "Production Technician - SkillBridge",
    employmentType: "Intern",
    description:
      "Anduril Industries is a defense technology company powered by Lattice OS, an AI-powered operating system.",
    locations: ["Costa Mesa, CA"],
  });

  assert.equal(result.include, false);
  assert.equal(result.reason, "non_engineering_role");
  assert.ok(result.signals.includes("negative:metadata_only_non_engineering_title"));
});

test("rejects wealth-management branch interns that only mention market research", () => {
  const result = classifyScrapeRole({
    title: "Intern",
    description:
      "Develop business skills for global wealth management. Provide marketing and sales support. Perform market research.",
    departments: ["Intern - Non-Program"],
    locations: ["Pasadena, CA"],
  });

  assert.equal(result.include, false);
  assert.equal(result.reason, "non_engineering_role");
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

test("video algorithms intern in engineering department is included", () => {
  const result = classifyScrapeRole({
    title: "Video Algorithms Intern, Video Coding (Gaussian Splatting), Fall 2026",
    description:
      "Gaussian Splatting (GS) is a 3D/4D scene reconstruction technique that enables photorealistic novel-view synthesis.",
    departments: ["Engineering"],
    locations: ["Los Gatos, California, United States of America"],
  });

  assert.equal(result.include, true);
  assert.equal(result.reason, "included");
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

test("rejects explicit intern titles that only match engineering via company boilerplate", () => {
  for (const candidate of [
    {
      title: "Vendor Management Internship",
      description:
        "As an Intern in the Vendor Management Team, you will support vendor partnerships that power our banking infrastructure.",
      departments: ["Operations"],
    },
    {
      title: "Social Media Intern",
      description:
        "At Skild AI, we are building robotic intelligence through data-driven machine learning at massive scale.",
      departments: ["Marketing"],
    },
    {
      title: "Logistics Intern",
      description:
        "At Lucid, we are creating exceptional mobility experiences through innovation and software-defined vehicles.",
      departments: ["Transportation"],
    },
  ]) {
    const result = classifyScrapeRole(candidate);
    assert.equal(result.include, false, candidate.title);
    assert.equal(result.reason, "non_engineering_role", candidate.title);
    assert.ok(result.signals.includes("negative:missing_engineering_signal"), candidate.title);
  }
});

test("still includes explicit intern titles with engineering in title or department", () => {
  const byDepartment = classifyScrapeRole({
    title: "Video Algorithms Intern, Fall 2026",
    description: "Gaussian Splatting is a 3D scene reconstruction technique.",
    departments: ["Engineering"],
    locations: ["Los Gatos, CA"],
  });
  assert.equal(byDepartment.include, true);

  const byTitle = classifyScrapeRole({
    title: "Software Engineering Intern",
    description: "About our company and culture.",
    locations: ["San Francisco, CA"],
  });
  assert.equal(byTitle.include, true);
});
