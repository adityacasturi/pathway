import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInstantAlertHtml,
  buildInstantAlertSubject,
} from "../../lib/email/templates/instant-alert.ts";
import {
  buildDigestAlertHtml,
  buildDigestAlertSubject,
} from "../../lib/email/templates/digest-alert.ts";
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
  firstSeenAt: "2026-06-01T12:00:00.000Z",
};

const secondPosting: AlertPostingCandidate = {
  ...posting,
  postingId: "p2",
  companySlug: "stripe",
  companyName: "Stripe",
  roleName: "Backend Engineering Intern",
  postingUrl: "https://example.com/stripe-intern",
  location: "New York, NY",
};

test("alert emails use Pathway branding and avoid em dashes", () => {
  const instantSubject = buildInstantAlertSubject(posting);
  const digestSubject = buildDigestAlertSubject(1);
  const instantHtml = buildInstantAlertHtml("11111111-1111-4111-8111-111111111111", posting);
  const digestHtml = buildDigestAlertHtml("11111111-1111-4111-8111-111111111111", [posting]);
  const combined = [instantSubject, digestSubject, instantHtml, digestHtml].join("\n");

  assert.match(instantHtml, /pathway-logo-black-transparent-600w\.png/);
  assert.match(digestHtml, /pathway-logo-black-transparent-600w\.png/);
  assert.match(combined, /font-family:Inter,-apple-system,BlinkMacSystemFont/);
  assert.doesNotMatch(combined, /—/);
});

test("digest emails use compact logo sections with full-line clickable roles", () => {
  const digestHtml = buildDigestAlertHtml("11111111-1111-4111-8111-111111111111", [
    posting,
    secondPosting,
  ]);

  assert.match(digestHtml, /Pathway Alerts/);
  assert.match(digestHtml, /New roles from companies and bundles you follow/);
  assert.match(digestHtml, /company-logos\/openai\.png/);
  assert.match(digestHtml, /company-logos\/stripe\.png/);
  assert.doesNotMatch(digestHtml, /<ul|<li/);
  assert.doesNotMatch(digestHtml, /border-top:1px solid #eef0f2/);
  assert.match(
    digestHtml,
    /<span style="[^"]*font-size:16px[^"]*font-weight:650[^"]*">OpenAI<\/span>/,
  );
  assert.match(digestHtml, /<\/table>\s*<div style="margin:0 0 22px;">/);
  assert.match(
    digestHtml,
    /<a href="https:\/\/example\.com\/openai-intern" style="color:#111827;[^"]*text-decoration:underline[^"]*">Software Engineering Intern<\/a><span style="color:#6b7280;"> \| Summer 2027 \| San Francisco, CA<\/span>/,
  );
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
