import type { ScrapeSourceShard } from "@/lib/scraping/run-all";

export const MAX_SCRAPE_SHARDS = 16;

export interface ScrapeCronParams {
  includeAlerts: boolean;
  sourceShard?: ScrapeSourceShard;
}

export type ScrapeCronParamsResult =
  | { ok: true; value: ScrapeCronParams }
  | { ok: false; error: string };

export function parseScrapeCronParams(searchParams: URLSearchParams): ScrapeCronParamsResult {
  const includeAlerts = !isFalseParam(searchParams.get("alerts"));
  const shardValue = searchParams.get("shard");
  const shardsValue = searchParams.get("shards");

  if (shardValue === null && shardsValue === null) {
    return { ok: true, value: { includeAlerts } };
  }

  if (shardValue === null || shardsValue === null) {
    return { ok: false, error: "Both shard and shards query parameters are required." };
  }

  const index = parseIntegerParam(shardValue);
  const count = parseIntegerParam(shardsValue);
  if (index === null || count === null) {
    return { ok: false, error: "Shard query parameters must be integers." };
  }
  if (count < 1 || count > MAX_SCRAPE_SHARDS) {
    return { ok: false, error: `shards must be between 1 and ${MAX_SCRAPE_SHARDS}.` };
  }
  if (index < 0 || index >= count) {
    return { ok: false, error: "shard must be greater than or equal to 0 and less than shards." };
  }

  return { ok: true, value: { includeAlerts, sourceShard: { index, count } } };
}

function parseIntegerParam(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function isFalseParam(value: string | null): boolean {
  if (value === null) {
    return false;
  }
  return /^(0|false|no|off|skip)$/i.test(value.trim());
}
