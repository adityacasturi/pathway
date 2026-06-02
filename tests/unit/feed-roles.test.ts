import assert from "node:assert/strict";
import test from "node:test";
import {
  hasEngineeringSignal,
  hasInternshipSignal,
  isFullTimeGradRole,
  isInternshipEmploymentMetadata,
  isNonTargetRoleTitle,
  isPermanentEmploymentMetadata,
  isTargetEngineeringInternshipRole,
  matchesInternshipTitle,
} from "../../lib/feed/roles.ts";

test("matchesInternshipTitle avoids internal audit false positives", () => {
  assert.equal(matchesInternshipTitle("Software Engineering Intern"), true);
  assert.equal(matchesInternshipTitle("Internal Audit Lead"), false);
});

test("hasInternshipSignal reads description head only", () => {
  assert.equal(
    hasInternshipSignal("Software Engineer", "Join our summer internship program."),
    true,
  );
  const padded = `${"x".repeat(250)} internship program`;
  assert.equal(hasInternshipSignal("Software Engineer", padded), false);
});

test("isFullTimeGradRole detects new grad titles and context", () => {
  assert.equal(isFullTimeGradRole("Software Engineer - New Grad"), true);
  assert.equal(isFullTimeGradRole("Software Engineering Intern"), false);
});

test("engineering and non-target role helpers", () => {
  assert.equal(hasEngineeringSignal("Quantitative Research Intern"), true);
  assert.equal(isNonTargetRoleTitle("Product Design Intern"), true);
  assert.equal(
    isTargetEngineeringInternshipRole("Software Engineering Intern", "Python backend team"),
    true,
  );
  assert.equal(
    isTargetEngineeringInternshipRole("Marketing Intern", "Brand campaigns"),
    false,
  );
});

test("employment metadata helpers distinguish intern vs permanent", () => {
  assert.equal(isInternshipEmploymentMetadata("Intern"), true);
  assert.equal(isPermanentEmploymentMetadata("Full Time"), true);
  assert.equal(isPermanentEmploymentMetadata("Intern"), false);
});
