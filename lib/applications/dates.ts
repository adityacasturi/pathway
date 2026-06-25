import type { Application } from "@/types/application";

export function getAppliedDate(application: Application): string | null {
  const applied = application.events.find((event) => event.event_type === "applied");
  return applied?.event_date ?? null;
}
