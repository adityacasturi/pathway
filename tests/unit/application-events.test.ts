import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveStatus,
  eventLabel,
  STATUSES,
} from "../../lib/config/events.ts";
import type { ApplicationEvent } from "../../types/application.ts";

function makeEvent(
  eventType: ApplicationEvent["event_type"],
  overrides: Partial<ApplicationEvent> = {},
): ApplicationEvent {
  return {
    id: "evt-1",
    application_id: "app-1",
    event_type: eventType,
    event_date: "2026-01-15",
    notes: null,
    round_number: null,
    created_at: "2026-01-15T12:00:00.000Z",
    ...overrides,
  };
}

test("deriveStatus follows priority rejected > offer > interview > oa > applied", () => {
  assert.equal(deriveStatus([makeEvent("applied")]), "applied");
  assert.equal(deriveStatus([makeEvent("applied"), makeEvent("oa")]), "oa");
  assert.equal(
    deriveStatus([makeEvent("applied"), makeEvent("oa"), makeEvent("interview")]),
    "interview",
  );
  assert.equal(
    deriveStatus([
      makeEvent("applied"),
      makeEvent("oa"),
      makeEvent("interview"),
      makeEvent("offer"),
    ]),
    "offer",
  );
  assert.equal(
    deriveStatus([
      makeEvent("applied"),
      makeEvent("offer"),
      makeEvent("rejected"),
    ]),
    "rejected",
  );
  assert.equal(deriveStatus([makeEvent("note")]), "applied");
});

test("eventLabel includes interview round number when present", () => {
  assert.equal(eventLabel(makeEvent("oa")), "OA");
  assert.equal(
    eventLabel(makeEvent("interview", { round_number: 2 })),
    "Interview — Round 2",
  );
});

test("STATUSES lists every pipeline stage in order", () => {
  assert.deepEqual(STATUSES, ["applied", "oa", "interview", "offer", "rejected"]);
});
