import assert from "node:assert/strict";
import test from "node:test";
import { classifyScrapeRole } from "../../lib/scraping/classify-role.ts";

test("classifyScrapeRole includes Palantir FDSE internship in the US", () => {
  const result = classifyScrapeRole({
    title: "Forward Deployed Software Engineer, Internship - US Government",
    commitment: "Internship",
    locations: ["Washington, D.C."],
  });

  assert.equal(result.include, true);
  assert.equal(result.reason, "included");
});

test("classifyScrapeRole excludes Palantir Deployment Strategist internship", () => {
  const result = classifyScrapeRole({
    title: "Deployment Strategist, Internship",
    commitment: "Internship",
    locations: ["New York, NY"],
  });

  assert.equal(result.include, false);
  assert.equal(result.reason, "non_engineering_role");
});

test("classifyScrapeRole excludes non-US engineering internships", () => {
  const result = classifyScrapeRole({
    title: "Forward Deployed Software Engineer, Internship - France",
    commitment: "Internship",
    locations: ["Paris, France"],
  });

  assert.equal(result.include, false);
  assert.equal(result.reason, "non_us_location");
});

test("classifyScrapeRole excludes Internal Audit false positives", () => {
  const result = classifyScrapeRole({
    title: "Internal Audit Lead, Merchant Acquirer Limited Purpose Bank (MALPB)",
    locations: ["San Francisco, CA"],
  });

  assert.equal(result.include, false);
  assert.equal(result.reason, "title_false_positive");
});

test("classifyScrapeRole includes Ashby SWE intern with employment metadata", () => {
  const result = classifyScrapeRole({
    title: "Software Engineer, Android",
    employmentType: "Intern",
    team: "Emerging Talent - SWE",
    locations: ["New York, NY (HQ)", "San Francisco, CA"],
  });

  assert.equal(result.include, true);
});

test("classifyScrapeRole includes description-only internship signal for SWE roles", () => {
  const result = classifyScrapeRole({
    title: "Software Engineer",
    employmentType: "Intern",
    description: "Join our summer internship program as a software engineer building payments infrastructure.",
    locations: ["Remote US"],
  });

  assert.equal(result.include, true);
});

test("classifyScrapeRole excludes new grad engineering roles in university departments", () => {
  const result = classifyScrapeRole({
    title: "Software Engineer - New Grad",
    departments: ["University"],
    employmentType: "Full Time",
    locations: ["San Francisco, CA"],
  });

  assert.equal(result.include, false);
  assert.equal(result.reason, "full_time_grad_role");
});

test("classifyScrapeRole excludes entry level engineering titles", () => {
  const result = classifyScrapeRole({
    title: "Entry Level Software Engineer",
    locations: ["San Francisco, CA"],
  });

  assert.equal(result.include, false);
  assert.equal(result.reason, "full_time_grad_role");
});

test("classifyScrapeRole excludes entry-level engineering titles", () => {
  const result = classifyScrapeRole({
    title: "Software Engineer, Entry-Level",
    locations: ["Austin, TX"],
  });

  assert.equal(result.include, false);
  assert.equal(result.reason, "full_time_grad_role");
});

test("classifyScrapeRole excludes permanent engineering roles without internship signals", () => {
  const result = classifyScrapeRole({
    title: "Staff Software Engineer",
    commitment: "Permanent",
    locations: ["Denver, CO"],
  });

  assert.equal(result.include, false);
  assert.equal(result.reason, "no_internship_signal");
});

test("classifyScrapeRole excludes early career full-time engineering titles", () => {
  const result = classifyScrapeRole({
    title: "Early Career Software Engineer",
    locations: ["Costa Mesa, CA"],
  });

  assert.equal(result.include, false);
  assert.equal(result.reason, "no_internship_signal");
});

test("classifyScrapeRole excludes software engineer early career suffix titles", () => {
  const result = classifyScrapeRole({
    title: "Software Engineer, Early Career",
    locations: ["San Francisco, CA"],
  });

  assert.equal(result.include, false);
  assert.equal(result.reason, "no_internship_signal");
});

test("classifyScrapeRole excludes roles without a location", () => {
  const result = classifyScrapeRole({
    title: "Software Engineer, Intern",
    locations: [],
  });

  assert.equal(result.include, false);
  assert.equal(result.reason, "missing_location");
});

test("classifyScrapeRole includes SpaceX engineering intern with flexible US site location", () => {
  const result = classifyScrapeRole({
    title: "Fall 2026 Software Engineering Internship/Co-op",
    locations: ["Flexible - Any SpaceX Site"],
    departments: ["Engineering"],
  });

  assert.equal(result.include, true);
  assert.equal(result.reason, "included");
});

test("classifyScrapeRole leniently includes technology summer analyst internships", () => {
  const result = classifyScrapeRole({
    title: "Technology - Software Development, Summer Analyst, New York, United States, 2026",
    locations: ["New York, New York, United States"],
    departments: ["Operations & Technology", "Technology", "Internship"],
  });

  assert.equal(result.include, true);
});

test("classifyScrapeRole leniently includes engineering summer analyst titles", () => {
  const result = classifyScrapeRole({
    title: "2027 | Americas | New York | Engineering | Software Engineer Intern",
    locations: ["New York, New York, United States"],
    departments: ["Summer Analyst", "Engineering"],
    description: "Engineering Summer Analysts build software used across the firm.",
  });

  assert.equal(result.include, true);
});
