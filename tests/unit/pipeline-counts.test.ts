import assert from "node:assert/strict";
import test from "node:test";
import {
  applicationHasReachedStatus,
  countApplicationsByReachedStatus,
} from "../../lib/applications/pipeline-counts.ts";
import type { Application, ApplicationEvent } from "../../types/application.ts";

function applicationWithEvents(eventTypes: ApplicationEvent["event_type"][]): Application {
  return {
    id: "app-1",
    user_id: "user-1",
    company: "Acme",
    role: "Intern",
    posting_url: null,
    location: null,
    season: "Summer",
    status: "applied",
    archived_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    last_activity_date: "2026-01-01",
    events: eventTypes.map((eventType, index) => ({
      id: `evt-${index}`,
      application_id: "app-1",
      event_type: eventType,
      event_date: "2026-01-01",
      notes: null,
      round_number: null,
      created_at: "2026-01-01T00:00:00.000Z",
    })),
  };
}

test("applicationHasReachedStatus checks event history not derived status", () => {
  const app = applicationWithEvents(["applied", "oa"]);
  assert.equal(applicationHasReachedStatus(app, "oa"), true);
  assert.equal(applicationHasReachedStatus(app, "offer"), false);
});

test("countApplicationsByReachedStatus tallies each stage independently", () => {
  const counts = countApplicationsByReachedStatus([
    applicationWithEvents(["applied", "oa"]),
    applicationWithEvents(["applied", "oa", "interview", "offer"]),
    applicationWithEvents(["applied", "rejected"]),
  ]);

  assert.equal(counts.applied, 3);
  assert.equal(counts.oa, 2);
  assert.equal(counts.interview, 1);
  assert.equal(counts.offer, 1);
  assert.equal(counts.rejected, 1);
});
