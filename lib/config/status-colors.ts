import type { EventType, Status } from "@/types/application";

/** Canonical status colors for badges, timeline, snapshot, and charts. */
export const STATUS_COLORS = {
  applied: "#64748b",
  oa: "#60a5fa",
  interview: "#f09542",
  offer: "#6dae86",
  rejected: "#f87171",
} as const satisfies Record<Status, string>;

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  ...STATUS_COLORS,
  note: "#cbd5e1",
};

export function statusColor(status: Status): string {
  return STATUS_COLORS[status];
}
