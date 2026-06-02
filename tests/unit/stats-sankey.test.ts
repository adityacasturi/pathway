import assert from "node:assert/strict";
import test from "node:test";
import { computeStats } from "../../lib/stats/applications.ts";
import type { Application, ApplicationEvent, EventType, Status } from "../../types/application.ts";

function event(applicationId: string, eventType: EventType, index: number): ApplicationEvent {
  return {
    id: `${applicationId}-${eventType}-${index}`,
    application_id: applicationId,
    event_type: eventType,
    event_date: `2026-01-${String(index + 1).padStart(2, "0")}`,
    notes: null,
    round_number: eventType === "interview" ? index : null,
    created_at: `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
  };
}

function application(id: string, status: Status, eventTypes: EventType[]): Application {
  return {
    id,
    user_id: "user-1",
    company: `Company ${id}`,
    role: "Software Engineering Intern",
    posting_url: null,
    location: null,
    season: "Summer",
    status,
    archived_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    events: eventTypes.map((eventType, index) => event(id, eventType, index)),
    last_activity_date: "2026-01-01",
  };
}

test("Sankey leaves active stalled branches on their latest reached stage", () => {
  const stats = computeStats([
    application("oa-pending", "oa", ["applied", "oa"]),
    application("round-one-pending", "interview", ["applied", "oa", "interview"]),
    application("offer", "offer", ["applied", "oa", "interview", "interview", "offer"]),
  ]);

  const links = new Map(stats.sankey.links.map((link) => [link.id, link.value]));
  const nodes = new Map(stats.sankey.nodes.map((node) => [node.id, node.count]));

  assert.equal(links.get("applications_oa"), 3);
  assert.equal(links.get("oa_interview_1"), 2);
  assert.equal(links.get("interview_1_interview_2"), 1);
  assert.equal(links.get("interview_2_offers"), 1);
  assert.equal(nodes.get("oa"), 3);
  assert.equal(nodes.get("interview_1"), 2);
  assert.equal(nodes.has("in_progress"), false);
  assert.equal(links.has("oa_in_progress"), false);
  assert.equal(links.has("interview_1_in_progress"), false);
});

test("Sankey terminal outcomes come from the latest reached stage", () => {
  const stats = computeStats([
    application("oa-rejected", "rejected", ["applied", "oa", "rejected"]),
    application("round-one-rejected", "rejected", ["applied", "oa", "interview", "rejected"]),
    application("round-two-offer", "offer", ["applied", "oa", "interview", "interview", "offer"]),
  ]);

  const links = new Map(stats.sankey.links.map((link) => [link.id, link.value]));

  assert.equal(links.get("applications_oa"), 3);
  assert.equal(links.get("oa_rejected"), 1);
  assert.equal(links.get("oa_interview_1"), 2);
  assert.equal(links.get("interview_1_rejected"), 1);
  assert.equal(links.get("interview_1_interview_2"), 1);
  assert.equal(links.get("interview_2_offers"), 1);
  assert.equal(links.has("oa_offers"), false);
  assert.equal(links.has("oa_in_progress"), false);
  assert.equal(links.has("interview_1_in_progress"), false);
});
