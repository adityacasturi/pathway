import assert from "node:assert/strict";
import test from "node:test";
import {
  appendClassifiedRole,
  finishAdapterParse,
} from "../../lib/scraping/adapter-parse.ts";
import { atsPublishDate, unknownScrapedDates } from "../../lib/scraping/posted-date.ts";

const context = { companyName: "Acme", companySlug: "acme" };

test("appendClassifiedRole rejects non-target roles", () => {
  const result = appendClassifiedRole(
    {
      postingUrl: "https://jobs.example.com/1",
      title: "Marketing Intern",
      roleName: "Marketing Intern",
      locations: ["New York, NY"],
      dates: unknownScrapedDates(),
    },
    context,
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.rejection.reason, "non_engineering_role");
  }
});

test("appendClassifiedRole rejects invalid URLs", () => {
  const result = appendClassifiedRole(
    {
      postingUrl: "not-a-url",
      title: "Software Engineering Intern",
      roleName: "Software Engineering Intern",
      locations: ["San Francisco, CA"],
      dates: unknownScrapedDates(),
    },
    context,
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.rejection.reason, "invalid_url");
  }
});

test("appendClassifiedRole accepts engineering internships", () => {
  const result = appendClassifiedRole(
    {
      postingUrl: "https://jobs.example.com/swe-intern",
      title: "Software Engineering Intern",
      roleName: "Software Engineering Intern",
      locations: ["San Francisco, CA"],
      dates: atsPublishDate("2026-01-01"),
    },
    context,
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.role.roleName, "Software Engineering Intern");
    assert.equal(result.role.companyName, "Acme");
  }
});

test("finishAdapterParse aggregates roles and rejections", () => {
  const kept = appendClassifiedRole(
    {
      postingUrl: "https://jobs.example.com/1",
      title: "Software Engineering Intern",
      roleName: "Software Engineering Intern",
      locations: ["Remote US"],
      dates: unknownScrapedDates(),
    },
    context,
  );
  const rejected = appendClassifiedRole(
    {
      postingUrl: "https://jobs.example.com/2",
      title: "Sales Intern",
      roleName: "Sales Intern",
      locations: ["Chicago, IL"],
      dates: unknownScrapedDates(),
    },
    context,
  );

  const roles = kept.ok ? [kept.role] : [];
  const rejections = !rejected.ok ? [rejected.rejection] : [];
  const parsed = finishAdapterParse(2, roles, rejections);
  assert.equal(parsed.stats.kept, 1);
  assert.equal(parsed.stats.rejected.length, 1);
});
