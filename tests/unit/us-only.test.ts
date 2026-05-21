import assert from "node:assert/strict";
import test from "node:test";
import {
  isUsOnlyInternship,
  isUsOnlyInternshipCountries,
} from "../../lib/postings/us-only.ts";

test("isUsOnlyInternship accepts United States locations", () => {
  assert.equal(isUsOnlyInternship(["San Francisco, CA"]), true);
  assert.equal(isUsOnlyInternship(["Remote in US"]), true);
  assert.equal(isUsOnlyInternship(["New York, NY", "Remote"]), true);
});

test("isUsOnlyInternship rejects non-US or ambiguous locations", () => {
  assert.equal(isUsOnlyInternship(["London, UK"]), false);
  assert.equal(isUsOnlyInternship(["Toronto, Canada"]), false);
  assert.equal(isUsOnlyInternship(["New York, NY", "London, UK"]), false);
  assert.equal(isUsOnlyInternship(["Remote"]), false);
  assert.equal(isUsOnlyInternship([]), false);
});

test("isUsOnlyInternshipCountries mirrors stored country arrays", () => {
  assert.equal(isUsOnlyInternshipCountries(["US"]), true);
  assert.equal(isUsOnlyInternshipCountries(["CA", "US"]), false);
  assert.equal(isUsOnlyInternshipCountries([]), false);
});
