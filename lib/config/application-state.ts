import { deriveStatus } from "@/lib/config/events";
import type { Application, ApplicationEvent } from "@/types/application";

/** Pipeline order for same-day ties — matches `STATUS_PRIORITY` in `events.ts`. */
const CHRONOLOGICAL_EVENT_ORDER: Partial<Record<ApplicationEvent["event_type"], number>> = {
  applied: 1,
  oa: 2,
  interview: 3,
  offer: 4,
  rejected: 5,
};

/**
 * Compare events for chronological order (oldest → newest). Primary key is
 * `event_date`. Same-day ties:
 *   1. Interview rounds: lower `round_number` first.
 *   2. Pipeline stage (`applied` before `oa`, etc.).
 *   3. `created_at` ascending.
 */
export function compareEventsChronologically(
  a: ApplicationEvent,
  b: ApplicationEvent,
): number {
  const byDate = a.event_date.localeCompare(b.event_date);
  if (byDate !== 0) return byDate;

  if (
    a.event_type === "interview" &&
    b.event_type === "interview" &&
    a.round_number != null &&
    b.round_number != null
  ) {
    const byRound = a.round_number - b.round_number;
    if (byRound !== 0) return byRound;
  }

  const orderA = CHRONOLOGICAL_EVENT_ORDER[a.event_type] ?? 0;
  const orderB = CHRONOLOGICAL_EVENT_ORDER[b.event_type] ?? 0;
  if (orderA !== orderB) return orderA - orderB;

  return a.created_at.localeCompare(b.created_at);
}

/** Newest-first timeline order (inspector, activity feeds). */
export function compareEventsNewestFirst(
  a: ApplicationEvent,
  b: ApplicationEvent,
): number {
  return compareEventsChronologically(b, a);
}

function sortEventsByDate(events: ApplicationEvent[]): ApplicationEvent[] {
  return [...events].sort(compareEventsChronologically);
}

function getLastActivityDate(createdAt: string, events: ApplicationEvent[]): string {
  return events.length > 0 ? events[events.length - 1].event_date : createdAt.slice(0, 10);
}

export function normalizeApplicationState(application: Application): Application {
  const events = sortEventsByDate(application.events);
  return {
    ...application,
    events,
    status: deriveStatus(events),
    last_activity_date: getLastActivityDate(application.created_at, events),
  };
}

export function addEvent(application: Application, event: ApplicationEvent): Application {
  return normalizeApplicationState({ ...application, events: [...application.events, event] });
}

export function removeEvent(application: Application, eventId: string): Application {
  return normalizeApplicationState({ ...application, events: application.events.filter((e) => e.id !== eventId) });
}

export function applyEventPatch(application: Application, eventId: string, patch: Partial<ApplicationEvent>): Application {
  return normalizeApplicationState({
    ...application,
    events: application.events.map((e) => (e.id === eventId ? { ...e, ...patch } : e)),
  });
}

export function replaceEvent(application: Application, oldEventId: string, replacement: ApplicationEvent): Application {
  const oldEvent = application.events.find((event) => event.id === oldEventId);
  const nextReplacement =
    oldEvent?.clientKey && !replacement.clientKey
      ? { ...replacement, clientKey: oldEvent.clientKey }
      : replacement;

  return normalizeApplicationState({
    ...application,
    events: application.events.map((event) => (event.id === oldEventId ? nextReplacement : event)),
  });
}

export function getNextInterviewRound(events: ApplicationEvent[]): number {
  return events.filter((e) => e.event_type === "interview").length + 1;
}
