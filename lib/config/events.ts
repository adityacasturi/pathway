import type { ApplicationEvent, EventType, Status } from "@/types/application";
import { EVENT_TYPE_COLORS } from "@/lib/config/status-colors";

export const STATUSES: Status[] = ["applied", "oa", "interview", "offer", "rejected"];

export const STATUS_LABELS: Record<Status, string> = {
  applied:   "Applied",
  oa:        "OA",
  interview: "Interview",
  offer:     "Offer",
  rejected:  "Rejected",
};

export const ADDABLE_EVENT_TYPES: EventType[] = ["oa", "interview", "offer", "rejected"];

// Canonical color per event type — see `lib/config/status-colors.ts`.
//   - applied   → muted slate
//   - oa        → blue
//   - interview → orange
//   - offer     → green
//   - rejected  → red
//   - note      → soft gray
export const EVENT_CONFIG: Record<EventType, { label: string; color: string }> = {
  applied:   { label: "Applied",   color: EVENT_TYPE_COLORS.applied },
  oa:        { label: "OA",        color: EVENT_TYPE_COLORS.oa },
  interview: { label: "Interview", color: EVENT_TYPE_COLORS.interview },
  offer:     { label: "Offer",     color: EVENT_TYPE_COLORS.offer },
  rejected:  { label: "Rejected",  color: EVENT_TYPE_COLORS.rejected },
  note:      { label: "Note",      color: EVENT_TYPE_COLORS.note },
};

export function eventLabel(event: ApplicationEvent): string {
  if (event.event_type === "interview" && event.round_number) {
    return `Interview — Round ${event.round_number}`;
  }
  return EVENT_CONFIG[event.event_type].label;
}

// Status is always derived from events — never set manually.
// Priority: rejected > offer > interview > oa > applied
const STATUS_PRIORITY: Partial<Record<EventType, number>> = {
  rejected:  5,
  offer:     4,
  interview: 3,
  oa:        2,
  applied:   1,
};

export function deriveStatus(events: Pick<ApplicationEvent, "event_type">[]): Status {
  let best: Status = "applied";
  let bestPriority = 0;
  for (const { event_type } of events) {
    const p = STATUS_PRIORITY[event_type] ?? 0;
    if (p > bestPriority) {
      bestPriority = p;
      best = event_type as Status;
    }
  }
  return best;
}
