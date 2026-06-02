import { createGreenhouseAdapter } from "./greenhouse.ts";
import type { CompanySourceConfig, ScrapeAdapter } from "../types.ts";

/**
 * Five Rings campus roles use Greenhouse board `fiveringsllc`.
 * Public API: boards-api.greenhouse.io/v1/boards/fiveringsllc/jobs
 * Posting URLs resolve to job-boards.greenhouse.io/fiveringsllc/jobs/...
 */
export const FIVE_RINGS_GREENHOUSE_BOARD_TOKEN = "fiveringsllc";

export const FIVE_RINGS_CAREERS_URL = "https://fiverings.com/careers/";

const FIVE_RINGS_GREENHOUSE_HOSTS = ["boards.greenhouse.io", "job-boards.greenhouse.io"];

export function resolveFiveRingsGreenhouseSource(
  source: CompanySourceConfig,
): CompanySourceConfig {
  const boardToken = source.boardToken?.trim() || FIVE_RINGS_GREENHOUSE_BOARD_TOKEN;
  const sourceUrl = isFiveRingsGreenhouseUrl(source.sourceUrl)
    ? source.sourceUrl.trim()
    : FIVE_RINGS_CAREERS_URL;

  if (source.boardToken === boardToken && source.sourceUrl === sourceUrl) {
    return source;
  }

  return { ...source, boardToken, sourceUrl };
}

export function isFiveRingsGreenhouseUrl(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    if (!FIVE_RINGS_GREENHOUSE_HOSTS.includes(parsed.hostname.toLowerCase())) {
      return false;
    }
    return parsed.pathname.toLowerCase().includes(FIVE_RINGS_GREENHOUSE_BOARD_TOKEN);
  } catch {
    return false;
  }
}

export function createFiveRingsAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const resolved = resolveFiveRingsGreenhouseSource(source);
  const greenhouse = createGreenhouseAdapter({ ...resolved, sourceType: "greenhouse" });

  return {
    source: resolved,
    fetchRoles: () => greenhouse.fetchRoles(),
  };
}
