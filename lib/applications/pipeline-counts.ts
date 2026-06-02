import { STATUSES } from "@/lib/config/events";
import type { Application, Status } from "@/types/application";

export function applicationHasReachedStatus(
  application: Application,
  status: Status,
): boolean {
  return application.events.some((event) => event.event_type === status);
}

export function countApplicationsByReachedStatus(
  applications: Application[],
): Record<Status, number> {
  return Object.fromEntries(
    STATUSES.map((status) => [
      status,
      applications.filter((application) =>
        applicationHasReachedStatus(application, status),
      ).length,
    ]),
  ) as Record<Status, number>;
}

export function formatPipelineReachPercent(count: number, total: number) {
  if (total === 0) return "0%";
  return `${Math.round((count / total) * 100)}%`;
}

export function formatPipelineReachFigure(count: number, total: number) {
  return `${count} (${formatPipelineReachPercent(count, total)})`;
}
