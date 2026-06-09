const QSTASH_SCHEDULES_URL = "https://qstash.upstash.io/v2/schedules";

export interface QstashScheduleDefinition {
  id: string;
  cron: string;
  destination: string;
  timeout: string;
}

export interface QstashScheduleRequest {
  url: string;
  headers: Record<string, string>;
}

const RETIRED_PRODUCTION_QSTASH_SCHEDULE_IDS = [
  "pathway-discover-scrape-shard-0",
  "pathway-discover-scrape-shard-1",
  "pathway-discover-scrape-shard-2",
  "pathway-discover-scrape-shard-3",
  "pathway-alerts-instant-delivery",
  "pathway-scrape-shard-0",
  "pathway-scrape-shard-1",
  "pathway-scrape-shard-2",
  "pathway-scrape-shard-3",
  "pathway-instant-alerts",
  "pathway-daily-digest",
  "pathway-alerts-daily-digest",
  "pathway-sync-search-index",
];

export function getProductionQstashSchedules(_baseUrl: string): QstashScheduleDefinition[] {
  return [];
}

export function getProductionQstashScheduleIds(): string[] {
  return [];
}

export function getRetiredProductionQstashScheduleIds(): string[] {
  return RETIRED_PRODUCTION_QSTASH_SCHEDULE_IDS;
}

export function buildQstashScheduleRequest(
  schedule: QstashScheduleDefinition,
  cronSecret: string,
  qstashUrl = QSTASH_SCHEDULES_URL,
): QstashScheduleRequest {
  return {
    url: `${normalizeQstashSchedulesUrl(qstashUrl)}/${encodeQstashDestination(schedule.destination)}`,
    headers: {
      "Content-Type": "text/plain",
      "Upstash-Cron": schedule.cron,
      "Upstash-Forward-Authorization": `Bearer ${cronSecret}`,
      "Upstash-Method": "GET",
      "Upstash-Retries": "2",
      "Upstash-Schedule-Id": schedule.id,
      "Upstash-Timeout": schedule.timeout,
    },
  };
}

export function getQstashSchedulesUrl(): string {
  return QSTASH_SCHEDULES_URL;
}

export function normalizeQstashSchedulesUrl(qstashUrl: string): string {
  const trimmed = qstashUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("QSTASH_URL must include http:// or https://");
  }
  if (trimmed.endsWith("/v2/schedules")) {
    return trimmed;
  }
  return `${trimmed}/v2/schedules`;
}

function encodeQstashDestination(destination: string): string {
  return encodeURIComponent(destination)
    .replaceAll("%3A", ":")
    .replaceAll("%2F", "/")
    .replaceAll("%3F", "?")
    .replaceAll("%26", "&")
    .replaceAll("%3D", "=");
}
