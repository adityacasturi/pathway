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
  firstSeenAt: "2026-06-01T12:00:00.000Z",
};

test("alert emails use Pathway branding and avoid em dashes", () => {
  const instantSubject = buildInstantAlertSubject(posting);
  const digestSubject = buildDigestAlertSubject(1);
  const instantHtml = buildInstantAlertHtml("11111111-1111-4111-8111-111111111111", posting);
  const digestHtml = buildDigestAlertHtml("11111111-1111-4111-8111-111111111111", [posting]);
  const combined = [instantSubject, digestSubject, instantHtml, digestHtml].join("\n");

  assert.match(instantHtml, /pathway-logo-black-transparent-600w\.png/);
  assert.match(digestHtml, /pathway-logo-black-transparent-600w\.png/);
  assert.match(combined, /font-family:Arial,Helvetica,sans-serif/);
  assert.doesNotMatch(combined, /—/);
});
