import assert from "node:assert/strict";
import test from "node:test";

import { resolvePostedAt } from "@/lib/scraping/posted-at";

const EXISTING = {
  id: "posting-1",
  first_seen_at: "2025-08-07T20:49:38.961Z",
  posted_at: "2025-08-07T20:49:38.961Z",
  role_name: "Software Engineer Internship, Android - Summer 2026",
  season: "Summer",
};

test("resolvePostedAt does not bump solely from a newer ATS updatedAt", () => {
  const decision = resolvePostedAt(
    EXISTING,
    {
      season: "Summer",
      atsDates: {
        publishedAt: "2025-08-07T20:49:38.961Z",
        updatedAt: "2026-06-04T16:57:38.597Z",
      },
    },
    "2026-06-10T12:00:00.000Z",
  );

  assert.deepEqual(decision, {
    postedAt: "2025-08-07T20:49:38.961Z",
    republished: false,
  });
});

test("resolvePostedAt bumps to ATS updatedAt when the season changes", () => {
  const decision = resolvePostedAt(
    EXISTING,
    {
      roleName: "Software Engineer Internship, Android",
      description: "Fall Program (August/September 2026 - December 2026)",
      season: "Fall",
      atsDates: {
        publishedAt: "2025-08-07T20:49:38.961Z",
        updatedAt: "2026-06-04T16:57:38.597Z",
      },
    },
    "2026-06-10T12:00:00.000Z",
  );

  assert.deepEqual(decision, {
    postedAt: "2026-06-04T16:57:38.597Z",
    republished: true,
  });
});

test("resolvePostedAt ignores ATS updatedAt close to publishedAt", () => {
  const decision = resolvePostedAt(
    EXISTING,
    {
      season: "Summer",
      atsDates: {
        publishedAt: "2025-08-07T20:49:38.961Z",
        updatedAt: "2025-08-07T21:49:38.961Z",
      },
    },
    "2026-06-10T12:00:00.000Z",
  );

  assert.deepEqual(decision, {
    postedAt: "2025-08-07T20:49:38.961Z",
    republished: false,
  });
});

test("resolvePostedAt bumps to now when season changes without ATS update metadata", () => {
  const decision = resolvePostedAt(
    EXISTING,
    {
      roleName: "Software Engineer Internship, Android - Fall 2026",
      season: "Fall",
      atsDates: {},
    },
    "2026-06-10T12:00:00.000Z",
  );

  assert.deepEqual(decision, {
    postedAt: "2026-06-10T12:00:00.000Z",
    republished: true,
  });
});

test("resolvePostedAt does not bump when a season change has no explicit next-season signal", () => {
  const decision = resolvePostedAt(
    { ...EXISTING, season: "Fall" },
    {
      roleName: "Software Engineer Internship, Android",
      description: "Internship program",
      season: "Summer",
      atsDates: {},
    },
    "2026-06-10T12:00:00.000Z",
  );

  assert.deepEqual(decision, {
    postedAt: "2025-08-07T20:49:38.961Z",
    republished: false,
  });
});

test("resolvePostedAt does not bump when the previous season was inferred", () => {
  const decision = resolvePostedAt(
    {
      ...EXISTING,
      role_name: "Backend Software Engineering Intern - Fall 2026",
      season: "Summer",
    },
    {
      roleName: "Backend Software Engineering Intern - Fall 2026",
      season: "Fall",
      atsDates: {},
    },
    "2026-06-16T17:06:25.000Z",
  );

  assert.deepEqual(decision, {
    postedAt: "2025-08-07T20:49:38.961Z",
    republished: false,
  });
});

test("resolvePostedAt bumps stale reused ATS IDs when the current program year is explicit", () => {
  const decision = resolvePostedAt(
    {
      ...EXISTING,
      first_seen_at: "2024-03-20T23:14:43.000Z",
      posted_at: "2024-03-20T23:14:43.000Z",
      role_name: "Hardware Engineer (Fall Co-op)",
      season: "Fall",
    },
    {
      roleName: "Hardware Engineer (Fall Co-op)",
      description: "Available for a Fall 2026 Co-Op, preferably for an extended term.",
      season: "Fall",
      atsDates: {
        publishedAt: "2024-03-20T23:14:43.000Z",
        updatedAt: "2026-06-16T23:39:01.000Z",
      },
    },
    "2026-06-21T12:00:00.000Z",
  );

  assert.deepEqual(decision, {
    postedAt: "2026-06-16T23:39:01.000Z",
    republished: true,
  });
});

test("resolvePostedAt does not bump plausible current-season first-published rows", () => {
  const decision = resolvePostedAt(
    {
      ...EXISTING,
      first_seen_at: "2026-04-06T22:16:27.000Z",
      posted_at: "2026-04-06T22:16:27.000Z",
      role_name: "Backend Software Engineering Intern - Fall 2026",
      season: "Fall",
    },
    {
      roleName: "Backend Software Engineering Intern - Fall 2026",
      season: "Fall",
      atsDates: {
        publishedAt: "2026-04-06T22:16:27.000Z",
        updatedAt: "2026-06-16T17:06:25.000Z",
      },
    },
    "2026-06-21T12:00:00.000Z",
  );

  assert.deepEqual(decision, {
    postedAt: "2026-04-06T22:16:27.000Z",
    republished: false,
  });
});

test("resolvePostedAt does not bump for title-only scrape churn", () => {
  const decision = resolvePostedAt(
    EXISTING,
    {
      roleName: "Software Engineer Intern, Android",
      season: "Summer",
      atsDates: {},
    },
    "2026-06-10T12:00:00.000Z",
  );

  assert.deepEqual(decision, {
    postedAt: "2025-08-07T20:49:38.961Z",
    republished: false,
  });
});
