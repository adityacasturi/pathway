import type { CompanySourceConfig, ScrapeAdapter } from "../types.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";
import {
  enrichWorkdayPostings,
  fetchWorkdayJobSummaries,
  parseWorkdayCareersUrl,
  parseWorkdayPostings,
} from "./workday.ts";

/**
 * VMware careers are hosted on Broadcom Workday after acquisition.
 * Search "vmware intern" to scope listings on the shared External_Career board.
 */
export const VMWARE_BROADCOM_WORKDAY_CAREERS_URL =
  "https://broadcom.wd1.myworkdayjobs.com/en-US/External_Career";

export const VMWARE_BROADCOM_WORKDAY_SITE = "External_Career";

const VMWARE_WORKDAY_SEARCH_TEXT = "vmware intern";

export function resolveVmwareWorkdaySource(source: CompanySourceConfig): CompanySourceConfig {
  const url = source.sourceUrl.trim();
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "broadcom.wd1.myworkdayjobs.com") {
      const boardToken = source.boardToken?.trim() || VMWARE_BROADCOM_WORKDAY_SITE;
      return boardToken === source.boardToken ? source : { ...source, boardToken };
    }
  } catch {
    // fall through
  }

  return {
    ...source,
    sourceUrl: VMWARE_BROADCOM_WORKDAY_CAREERS_URL,
    boardToken: VMWARE_BROADCOM_WORKDAY_SITE,
  };
}

export function createVmwareAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const resolved = resolveVmwareWorkdaySource(source);
  const board = parseWorkdayCareersUrl(resolved.sourceUrl, resolved.boardToken);
  const resolvedSource =
    resolved.boardToken === board.site ? resolved : { ...resolved, boardToken: board.site };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const summaries = await fetchWorkdayJobSummaries(board, VMWARE_WORKDAY_SEARCH_TEXT);
      const candidates = summaries.filter((summary) =>
        INTERNSHIP_LIST_TITLE_PATTERN.test(summary.title?.trim() ?? ""),
      );

      const enriched = await enrichWorkdayPostings(board, candidates);
      return parseWorkdayPostings(enriched, resolvedSource, board, summaries.length);
    },
  };
}
