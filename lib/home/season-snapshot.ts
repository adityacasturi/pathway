import { countApplicationsByReachedStatus } from "@/lib/applications/pipeline-counts";
import { STATUSES } from "@/lib/config/events";
import type { Application, ApplicationSeason, Status } from "@/types/application";

export type SeasonSnapshot = {
  season: ApplicationSeason;
  seasonLabel: string;
  counts: Record<Status, number>;
  total: number;
};

function currentRecruitingYear(now = new Date()): number {
  return now.getFullYear();
}

export function formatSeasonLabel(season: ApplicationSeason, now = new Date()): string {
  return `${season} ${currentRecruitingYear(now)}`;
}

export function resolveFocusSeason(applications: Application[]): ApplicationSeason {
  const counts = new Map<ApplicationSeason, number>();

  for (const application of applications) {
    if (!application.season) continue;
    counts.set(application.season, (counts.get(application.season) ?? 0) + 1);
  }

  if (counts.size === 0) return "Summer";

  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

export function buildSeasonSnapshot(
  applications: Application[],
  now = new Date(),
): SeasonSnapshot {
  const active = applications.filter((application) => !application.archived_at);
  const season = resolveFocusSeason(active);
  const counts = countApplicationsByReachedStatus(active);

  return {
    season,
    seasonLabel: formatSeasonLabel(season, now),
    counts,
    total: active.length,
  };
}

export function seasonSnapshotStatuses(): Status[] {
  return [...STATUSES];
}
