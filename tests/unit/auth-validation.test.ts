import assert from "node:assert/strict";
import test from "node:test";
import {
  getEmailValidationError,
  getSignupEmailValidationError,
  getSignupPasswordError,
  getSignupPasswordRules,
  normalizeEmail,
} from "../../lib/auth/validation.ts";

test("normalizeEmail lowercases and trims", () => {
  assert.equal(normalizeEmail("  Student@Example.EDU  "), "student@example.edu");
});

test("getEmailValidationError rejects malformed and disposable addresses", () => {
  assert.equal(getEmailValidationError(""), "Enter a valid email address.");
  assert.equal(getEmailValidationError("bad"), "Enter a valid email address.");
  assert.equal(
    getEmailValidationError("user@mailinator.com"),
    "Use a permanent email address.",
  );
  assert.equal(getEmailValidationError("valid.user@university.edu"), null);
});

test("getSignupEmailValidationError accepts any valid email domain", () => {
  assert.equal(getSignupEmailValidationError("user@gmail.com"), null);
  assert.equal(getSignupEmailValidationError("user@school.edu"), null);
  assert.equal(
    getSignupEmailValidationError("user@mailinator.com"),
    "Use a permanent email address.",
  );
  assert.equal(getSignupEmailValidationError("bad"), "Enter a valid email address.");
});

test("getSignupPasswordRules and getSignupPasswordError enforce complexity", () => {
  const rules = getSignupPasswordRules("short", "student@school.edu");
  assert.equal(rules.find((rule) => rule.id === "length")?.met, false);

  const strong = "Pathway9!";
  assert.equal(getSignupPasswordError(strong, "student@school.edu"), null);
  assert.equal(
    getSignupPasswordError("SecurePass9!candidate", "candidate@school.edu"),
    "Password cannot contain the first part of your email address.",
  );
});
