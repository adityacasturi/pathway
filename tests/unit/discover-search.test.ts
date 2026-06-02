import assert from "node:assert/strict";
import test from "node:test";
import {
  companyMatchesSearch,
  getDiscoverSearchTerms,
  postingMatchesSearch,
} from "../../lib/discover/search.ts";

test("getDiscoverSearchTerms splits quoted phrases and words", () => {
  assert.deepEqual(getDiscoverSearchTerms('stripe "summer intern"'), [
    "stripe",
    "summer intern",
  ]);
});

test("companyMatchesSearch matches name and slug", () => {
  const company = { name: "Stripe", slug: "stripe" };
  assert.equal(companyMatchesSearch(company, []), true);
  assert.equal(companyMatchesSearch(company, ["strip"]), true);
  assert.equal(companyMatchesSearch(company, ["ramp"]), false);
  assert.equal(companyMatchesSearch(company, ["stripe", "strip"]), true);
});

test("postingMatchesSearch matches role name and location", () => {
  const posting = {
    roleName: "Software Engineer Intern",
    location: "San Francisco, CA",
  };
  assert.equal(postingMatchesSearch(posting, []), true);
  assert.equal(postingMatchesSearch(posting, ["engineer"]), true);
  assert.equal(postingMatchesSearch(posting, ["francisco"]), true);
  assert.equal(postingMatchesSearch(posting, ["new york"]), false);
  assert.equal(postingMatchesSearch(posting, ["engineer", "san"]), true);
});
