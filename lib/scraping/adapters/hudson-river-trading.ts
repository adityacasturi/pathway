import { createGreenhouseAdapter } from "./greenhouse.ts";
import type { CompanySourceConfig, ScrapeAdapter } from "../types.ts";

/**
 * HRT campus recruiting uses Greenhouse board `hrttalentcommunity` (not company slug).
 * Public API: boards-api.greenhouse.io/v1/boards/hrttalentcommunity/jobs
 */
export const HRT_GREENHOUSE_BOARD_TOKEN = "hrttalentcommunity";

export const HRT_GREENHOUSE_CAREERS_URL =
  "https://job-boards.greenhouse.io/hrttalentcommunity";

const HRT_GREENHOUSE_HOSTS = ["boards.greenhouse.io", "job-boards.greenhouse.io"];

export function resolveHrtGreenhouseSource(source: CompanySourceConfig): CompanySourceConfig {
  const boardToken = source.boardToken?.trim() || HRT_GREENHOUSE_BOARD_TOKEN;
  const sourceUrl = isHrtGreenhouseUrl(source.sourceUrl)
    ? source.sourceUrl.trim()
    : HRT_GREENHOUSE_CAREERS_URL;

  if (source.boardToken === boardToken && source.sourceUrl === sourceUrl) {
    return source;
  }

  return { ...source, boardToken, sourceUrl };
}

export function isHrtGreenhouseUrl(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    if (!HRT_GREENHOUSE_HOSTS.includes(parsed.hostname.toLowerCase())) {
      return false;
    }
    return parsed.pathname.toLowerCase().includes(HRT_GREENHOUSE_BOARD_TOKEN);
  } catch {
    return false;
  }
}

export function createHudsonRiverTradingAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const resolved = resolveHrtGreenhouseSource(source);
  const greenhouse = createGreenhouseAdapter({ ...resolved, sourceType: "greenhouse" });

  return {
    source: resolved,
    fetchRoles: () => greenhouse.fetchRoles(),
  };
}
