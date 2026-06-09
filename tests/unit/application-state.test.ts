import assert from "node:assert/strict";
import test from "node:test";
import {
  addEvent,
  applyEventPatch,
  compareEventsNewestFirst,
  getNextInterviewRound,
  normalizeApplicationState,
  removeEvent,
  replaceEvent,
} from "../../lib/config/application-state.ts";
import type { Application, ApplicationEvent } from "../../types/application.ts";

function baseApplication(events: ApplicationEvent[]): Application {
  return {
    id: "app-1",
    user_id: "user-1",
    company: "Acme",
    role: "SWE Intern",
    posting_url: null,
    location: null,
    season: "Summer",
    status: "applied",
    archived_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    events,
    last_activity_date: "2026-01-01",
  };
}

function event(
  id: string,
  eventType: ApplicationEvent["event_type"],
  eventDate: string,
  extras: Partial<ApplicationEvent> = {},
): ApplicationEvent {
  return {
    id,
    application_id: "app-1",
    event_type: eventType,
    event_date: eventDate,
    notes: null,
    round_number: null,
    created_at: `${eventDate}T00:00:00.000Z`,
    ...extras,
  };
}

test("normalizeApplicationState sorts events and derives status", () => {
  const normalized = normalizeApplicationState(
    baseApplication([
      event("b", "oa", "2026-02-01"),
      event("a", "applied", "2026-01-01"),
    ]),
  );

  assert.equal(normalized.events[0]?.event_type, "applied");
  assert.equal(normalized.events[1]?.event_type, "oa");
  assert.equal(normalized.status, "oa");
  assert.equal(normalized.last_activity_date, "2026-02-01");
});

test("normalizeApplicationState orders applied before oa on the same day", () => {
  const normalized = normalizeApplicationState(
    baseApplication([
      event("oa", "oa", "2026-02-01", { created_at: "2026-02-01T12:00:00.000Z" }),
      event("applied", "applied", "2026-02-01", { created_at: "2026-02-01T18:00:00.000Z" }),
    ]),
  );

  assert.equal(normalized.events[0]?.event_type, "applied");
  assert.equal(normalized.events[1]?.event_type, "oa");
});

test("compareEventsNewestFirst shows oa above applied on the same day", () => {
  const applied = event("applied", "applied", "2026-02-01");
  const oa = event("oa", "oa", "2026-02-01");
  const newestFirst = [applied, oa].sort(compareEventsNewestFirst);

  assert.equal(newestFirst[0]?.event_type, "oa");
  assert.equal(newestFirst[1]?.event_type, "applied");
});

test("normalizeApplicationState orders interview rounds on the same day", () => {
  const normalized = normalizeApplicationState(
    baseApplication([
      event("r2", "interview", "2026-02-01", { round_number: 2 }),
      event("r1", "interview", "2026-02-01", { round_number: 1 }),
    ]),
  );

  assert.equal(normalized.events[0]?.round_number, 1);
  assert.equal(normalized.events[1]?.round_number, 2);
});

test("addEvent, removeEvent, applyEventPatch, and replaceEvent preserve invariants", () => {
  const initial = normalizeApplicationState(
    baseApplication([event("applied", "applied", "2026-01-01")]),
  );

  const withOa = addEvent(
    initial,
    event("oa", "oa", "2026-01-10", { created_at: "2026-01-10T00:00:00.000Z" }),
  );
  assert.equal(withOa.status, "oa");

  const patched = applyEventPatch(withOa, "oa", { notes: "48h window" });
  assert.equal(patched.events.find((e) => e.id === "oa")?.notes, "48h window");

  const replaced = replaceEvent(
    patched,
    "oa",
    event("oa-replaced", "oa", "2026-01-11", {
      clientKey: "client-oa",
      created_at: "2026-01-11T00:00:00.000Z",
    }),
  );
  assert.equal(replaced.events.some((e) => e.id === "oa"), false);
  assert.equal(replaced.events.find((e) => e.id === "oa-replaced")?.clientKey, "client-oa");

  const removed = removeEvent(replaced, "oa-replaced");
  assert.equal(removed.status, "applied");
});

test("getNextInterviewRound counts existing interview events", () => {
  const application = baseApplication([
    event("i1", "interview", "2026-02-01", { round_number: 1 }),
    event("i2", "interview", "2026-02-08", { round_number: 2 }),
  ]);
  assert.equal(getNextInterviewRound(application.events), 3);
});
