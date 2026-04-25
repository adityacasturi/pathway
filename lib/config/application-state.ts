import { deriveStatus } from "@/lib/config/events";
import { Application, ApplicationEvent } from "@/types/application";

/**
 * Sorts events for the timeline. Primary key is `event_date` (chronological).
 * Ties are broken in this order:
 *   1. Interview rounds: lower `round_number` first, so Round 1 → 2 → 3 stays
 *      stable even when rounds happen on the same day.
 *   2. `created_at` ascending — earliest-recorded event wins. This keeps the
 *      visual order stable across re-fetches (e.g. after adding a note).
 */
function sortEventsByDate(events: ApplicationEvent[]): ApplicationEvent[] {
  return [...events].sort((a, b) => {
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

    return a.created_at.localeCompare(b.created_at);
  });
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
  return normalizeApplicationState({
    ...application,
    events: application.events.map((e) => (e.id === oldEventId ? replacement : e)),
  });
}

export function getNextInterviewRound(events: ApplicationEvent[]): number {
  return events.filter((e) => e.event_type === "interview").length + 1;
}
