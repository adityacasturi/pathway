import { EventType, Status, ApplicationEvent } from "@/types/application";

export const STATUSES: Status[] = ["applied", "oa", "interview", "offer", "rejected"];

export const STATUS_LABELS: Record<Status, string> = {
  applied:   "Applied",
  oa:        "OA",
  interview: "Interview",
  offer:     "Offer",
  rejected:  "Rejected",
};

export const ADDABLE_EVENT_TYPES: EventType[] = ["oa", "interview", "offer", "rejected"];

// Canonical color per event type. Single source of truth for dots, halos,
// and any other event-tinted UI. Pills/badges use a richer palette derived
// from these in `components/status-badge.tsx`.
//   - applied   → muted slate (neutral starting state, on every timeline)
//   - oa        → blue (first signal)
//   - interview → purple (deeper engagement)
//   - offer     → green (positive outcome / success state)
//   - rejected  → red
//   - note      → soft gray (annotation, not a status)
export const EVENT_CONFIG: Record<EventType, { label: string; color: string }> = {
  applied:   { label: "Applied",   color: "#94a3b8" },
  oa:        { label: "OA",        color: "#60a5fa" },
  interview: { label: "Interview", color: "#a78bfa" },
  offer:     { label: "Offer",     color: "#4ade80" },
  rejected:  { label: "Rejected",  color: "#f87171" },
  note:      { label: "Note",      color: "#cbd5e1" },
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
