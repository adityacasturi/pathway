import { getAppliedDate } from "@/lib/chat/queries";
import type { Application } from "@/types/application";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type ApplicationAttention = "no_response" | "active";

function hasProgress(application: Application): boolean {
  return application.events.some(
    (event) => event.event_type !== "applied" && event.event_type !== "note",
  );
}

function hasTerminalDecision(application: Application): boolean {
  return application.events.some(
    (event) => event.event_type === "offer" || event.event_type === "rejected",
  );
}

export function applicationAttention(application: Application): ApplicationAttention | null {
  if (application.archived_at) return null;
  if (!hasProgress(application)) return "no_response";
  if (!hasTerminalDecision(application)) return "active";
  return null;
}

export function matchesApplicationAttention(
  application: Application,
  attention: ApplicationAttention,
): boolean {
  return applicationAttention(application) === attention;
}

export function applicationWaitingDays(application: Application, now = new Date()): number | null {
  if (applicationAttention(application) !== "no_response") return null;
  const appliedDate = getAppliedDate(application);
  if (!appliedDate) return null;
  const start = new Date(`${appliedDate}T00:00:00.000Z`).getTime();
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((end - start) / MS_PER_DAY));
}
