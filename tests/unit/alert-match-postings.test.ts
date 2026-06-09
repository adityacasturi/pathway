import assert from "node:assert/strict";
import test from "node:test";
import { enrichAlertPostingCandidate } from "../../lib/alerts/enrich-posting.ts";
import { DEFAULT_ALERT_FILTERS } from "../../lib/alerts/filters.ts";
import {
  isAlertEligiblePosting,
  matchPostingsToUsers,
} from "../../lib/alerts/match-postings.ts";
import type { AlertSubscription } from "../../lib/alerts/types.ts";

const quantSectorMembers = new Map<string, Set<string>>([
  ["quant", new Set(["jane-street"])],
]);

const posting = enrichAlertPostingCandidate({
  postingId: "p1",
  companyId: "c1",
  companySlug: "jane-street",
  industrySlug: "quant",
  companyName: "Acme",
  roleName: "SWE Intern",
  postingUrl: "https://example.com/1",
  season: "Summer",
  location: "San Francisco, CA",
  firstSeenAt: "2026-06-01T12:00:00.000Z",
});

const globalFiltersByUserId = new Map([["u1", DEFAULT_ALERT_FILTERS]]);

function matchOptions(overrides: Partial<Parameters<typeof matchPostingsToUsers>[3]> = {}) {
  return {
    enabledUserIds: new Set(["u1"]),
    sentKeys: new Set<string>(),
    channel: "instant" as const,
    globalFiltersByUserId,
    ...overrides,
  };
}

test("isAlertEligiblePosting requires a location string", () => {
  assert.equal(isAlertEligiblePosting({ ...posting, location: "" }), false);
  assert.equal(isAlertEligiblePosting({ ...posting, location: "London, UK" }), true);
  assert.equal(isAlertEligiblePosting(posting), true);
});

test("matchPostingsToUsers matches company subscription", () => {
  const subs: AlertSubscription[] = [
    {
      id: "s1",
      userId: "u1",
      targetType: "company",
      targetId: "c1",
      cadence: "instant",
      filterOverride: null,
      paused: false,
    },
  ];
  const matches = matchPostingsToUsers([posting], subs, quantSectorMembers, matchOptions());
  assert.equal(matches.length, 1);
  assert.equal(matches[0].userId, "u1");
});

test("matchPostingsToUsers matches sector subscription", () => {
  const subs: AlertSubscription[] = [
    {
      id: "s1",
      userId: "u1",
      targetType: "sector",
      targetId: "quant",
      cadence: "instant",
      filterOverride: null,
      paused: false,
    },
  ];
  const matches = matchPostingsToUsers([posting], subs, quantSectorMembers, matchOptions());
  assert.equal(matches.length, 1);
});

test("matchPostingsToUsers skips sector when company not in group", () => {
  const subs: AlertSubscription[] = [
    {
      id: "s1",
      userId: "u1",
      targetType: "sector",
      targetId: "faang",
      cadence: "instant",
      filterOverride: null,
      paused: false,
    },
  ];
  const matches = matchPostingsToUsers([posting], subs, quantSectorMembers, matchOptions());
  assert.equal(matches.length, 0);
});

test("matchPostingsToUsers skips invalid industry rows", () => {
  const subs = [
    {
      id: "s1",
      userId: "u1",
      targetType: "industry",
      targetId: "quant",
      cadence: "instant",
      filterOverride: null,
    },
    {
      id: "s2",
      userId: "u1",
      targetType: "industry",
      targetId: "quant",
      cadence: "digest",
      filterOverride: null,
    },
  ] as unknown as AlertSubscription[];
  const matches = matchPostingsToUsers([posting], subs, quantSectorMembers, {
    ...matchOptions(),
    channel: "digest",
    subscriptionCadences: ["instant", "digest"],
  });
  assert.equal(matches.length, 0);
});

test("matchPostingsToUsers matches instant follows for digest channel", () => {
  const subs: AlertSubscription[] = [
    {
      id: "s1",
      userId: "u1",
      targetType: "company",
      targetId: "c1",
      cadence: "instant",
      filterOverride: null,
      paused: false,
    },
  ];
  const matches = matchPostingsToUsers([posting], subs, quantSectorMembers, {
    ...matchOptions(),
    channel: "digest",
    subscriptionCadences: ["instant", "digest"],
  });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].channel, "digest");
});

test("matchPostingsToUsers skips disabled users and already sent", () => {
  const subs: AlertSubscription[] = [
    {
      id: "s1",
      userId: "u1",
      targetType: "company",
      targetId: "c1",
      cadence: "instant",
      filterOverride: null,
      paused: false,
    },
  ];
  const sentKeys = new Set(["u1:p1:instant"]);
  const matches = matchPostingsToUsers([posting], subs, quantSectorMembers, {
    enabledUserIds: new Set(["u2"]),
    sentKeys,
    channel: "instant",
    globalFiltersByUserId,
  });
  assert.equal(matches.length, 0);
});

test("matchPostingsToUsers applies global season filter", () => {
  const subs: AlertSubscription[] = [
    {
      id: "s1",
      userId: "u1",
      targetType: "company",
      targetId: "c1",
      cadence: "instant",
      filterOverride: null,
      paused: false,
    },
  ];
  const matches = matchPostingsToUsers([posting], subs, quantSectorMembers, {
    ...matchOptions(),
    globalFiltersByUserId: new Map([
      ["u1", { seasons: ["Fall"], countries: null, includeRemote: true }],
    ]),
  });
  assert.equal(matches.length, 0);
});

test("matchPostingsToUsers applies per-subscription override", () => {
  const subs: AlertSubscription[] = [
    {
      id: "s1",
      userId: "u1",
      targetType: "company",
      targetId: "c1",
      cadence: "instant",
      filterOverride: { seasons: ["Summer"] },
      paused: false,
    },
  ];
  const matches = matchPostingsToUsers([posting], subs, quantSectorMembers, {
    ...matchOptions(),
    globalFiltersByUserId: new Map([
      ["u1", { seasons: ["Fall"], countries: null, includeRemote: true }],
    ]),
  });
  assert.equal(matches.length, 1);
});

test("matchPostingsToUsers skips paused subscriptions", () => {
  const subs: AlertSubscription[] = [
    {
      id: "s1",
      userId: "u1",
      targetType: "company",
      targetId: "c1",
      cadence: "instant",
      filterOverride: null,
      paused: true,
    },
  ];
  const matches = matchPostingsToUsers([posting], subs, quantSectorMembers, matchOptions());
  assert.equal(matches.length, 0);
});
