import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInstantAlertHtml,
  buildInstantAlertSubject,
} from "../../lib/email/templates/instant-alert.ts";
import type { AlertPostingCandidate } from "../../lib/alerts/types.ts";

const posting: AlertPostingCandidate = {
  postingId: "p1",
  companyId: "c1",
  companySlug: "openai",
  industrySlug: "ai",
  companyName: "OpenAI",
  roleName: "Software Engineering Intern",
  postingUrl: "https://example.com/openai-intern",
  season: "Summer 2027",
  location: "San Francisco, CA",
  countries: ["US"],
  hasRemote: false,
  postedAt: "2026-06-01T12:00:00.000Z",
};

test("alert emails use Pathway branding and avoid em dashes", () => {
  const instantSubject = buildInstantAlertSubject(posting);
  const instantHtml = buildInstantAlertHtml("11111111-1111-4111-8111-111111111111", posting);
  const combined = [instantSubject, instantHtml].join("\n");

  assert.match(instantHtml, /pathway-logo-black-transparent-600w\.png/);
  assert.match(combined, /font-family:Inter,-apple-system,BlinkMacSystemFont/);
  assert.doesNotMatch(combined, /—/);
});

test("instant emails include the company logo and a full-line role link", () => {
  const instantHtml = buildInstantAlertHtml("11111111-1111-4111-8111-111111111111", posting);

  assert.match(instantHtml, /company-logos\/openai\.png/);
  assert.match(instantHtml, /posted a new internship/);
  assert.match(
    instantHtml,
    /<a href="https:\/\/example\.com\/openai-intern" style="color:#111827;[^"]*">Software Engineering Intern<\/a><span style="color:#6b7280;"> \| Summer 2027 \| San Francisco, CA<\/span>/,
  );
});
