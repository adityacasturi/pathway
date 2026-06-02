import { createGreenhouseAdapter } from "./greenhouse.ts";
import type { CompanySourceConfig, ScrapeAdapter } from "../types.ts";

/**
 * Tower Research campus roles use Greenhouse board `towerresearchcapital`.
 * Public API: boards-api.greenhouse.io/v1/boards/towerresearchcapital/jobs
 * Posting URLs resolve to tower-research.com/open-positions/?gh_jid=...
 */
export const TOWER_RESEARCH_GREENHOUSE_BOARD_TOKEN = "towerresearchcapital";

export const TOWER_RESEARCH_CAREERS_URL = "https://tower-research.com/careers/";

const TOWER_GREENHOUSE_HOSTS = ["boards.greenhouse.io", "job-boards.greenhouse.io"];

export function resolveTowerResearchGreenhouseSource(
  source: CompanySourceConfig,
): CompanySourceConfig {
  const boardToken = source.boardToken?.trim() || TOWER_RESEARCH_GREENHOUSE_BOARD_TOKEN;
  const sourceUrl = isTowerResearchGreenhouseUrl(source.sourceUrl)
    ? source.sourceUrl.trim()
    : TOWER_RESEARCH_CAREERS_URL;

  if (source.boardToken === boardToken && source.sourceUrl === sourceUrl) {
    return source;
  }

  return { ...source, boardToken, sourceUrl };
}

export function isTowerResearchGreenhouseUrl(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    if (!TOWER_GREENHOUSE_HOSTS.includes(parsed.hostname.toLowerCase())) {
      return false;
    }
    return parsed.pathname.toLowerCase().includes(TOWER_RESEARCH_GREENHOUSE_BOARD_TOKEN);
  } catch {
    return false;
  }
}

export function createTowerResearchAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const resolved = resolveTowerResearchGreenhouseSource(source);
  const greenhouse = createGreenhouseAdapter({ ...resolved, sourceType: "greenhouse" });

  return {
    source: resolved,
    fetchRoles: () => greenhouse.fetchRoles(),
  };
}
