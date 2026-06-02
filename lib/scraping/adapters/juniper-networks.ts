import type { CompanySourceConfig, ScrapeAdapter } from "../types.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";
import {
  enrichWorkdayPostings,
  fetchWorkdayJobSummaries,
  parseWorkdayCareersUrl,
  parseWorkdayPostings,
} from "./workday.ts";

/**
 * Juniper Networks careers redirect to HPE Workday (Jobsathpe) after acquisition.
 * Search "juniper intern" to scope listings to Juniper-related roles on the shared board.
 */
export const JUNIPER_HPE_WORKDAY_CAREERS_URL =
  "https://hpe.wd5.myworkdayjobs.com/en-US/Jobsathpe";

export const JUNIPER_HPE_WORKDAY_SITE = "Jobsathpe";

const JUNIPER_WORKDAY_SEARCH_TEXT = "juniper intern";

export function resolveJuniperWorkdaySource(source: CompanySourceConfig): CompanySourceConfig {
  const url = source.sourceUrl.trim();
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "hpe.wd5.myworkdayjobs.com") {
      const boardToken = source.boardToken?.trim() || JUNIPER_HPE_WORKDAY_SITE;
      return boardToken === source.boardToken ? source : { ...source, boardToken };
    }
  } catch {
    // fall through
  }

  return {
    ...source,
    sourceUrl: JUNIPER_HPE_WORKDAY_CAREERS_URL,
    boardToken: JUNIPER_HPE_WORKDAY_SITE,
  };
}

export function createJuniperNetworksAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const resolved = resolveJuniperWorkdaySource(source);
  const board = parseWorkdayCareersUrl(resolved.sourceUrl, resolved.boardToken);
  const resolvedSource =
    resolved.boardToken === board.site ? resolved : { ...resolved, boardToken: board.site };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const summaries = await fetchWorkdayJobSummaries(board, JUNIPER_WORKDAY_SEARCH_TEXT);
      const candidates = summaries.filter((summary) =>
        INTERNSHIP_LIST_TITLE_PATTERN.test(summary.title?.trim() ?? ""),
      );

      const enriched = await enrichWorkdayPostings(board, candidates);
      return parseWorkdayPostings(enriched, resolvedSource, board, summaries.length);
    },
  };
}
