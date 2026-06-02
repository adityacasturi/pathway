import type { CompanySourceConfig, ScrapeAdapter } from "../types.ts";
import {
  enrichWorkdayPostings,
  fetchWorkdayJobSummaries,
  parseWorkdayCareersUrl,
  parseWorkdayPostings,
  type WorkdayJobPostingSummary,
} from "./workday.ts";

/** Splunk roles are listed on Cisco Workday (Splunk is a Cisco company). */
export const SPLUNK_CISCO_CAREERS_URL =
  "https://cisco.wd5.myworkdayjobs.com/en-US/Cisco_Careers";
export const SPLUNK_CISCO_BOARD_TOKEN = "Cisco_Careers";

const SPLUNK_WORKDAY_SEARCHES = ["Splunk internship", "Splunk intern", "Splunktern"];

const INTERNSHIP_LIST_TITLE_PATTERN =
  /\bintern(?:ship|ships)?\b|\bco-?op\b|\bfellowship\b|\buniversity\b|\bsplunktern\b/i;

const SPLUNK_BRAND_PATTERN = /\bsplunk\b/i;

function isSplunkRelatedPosting(summary: WorkdayJobPostingSummary): boolean {
  const title = summary.title?.trim() ?? "";
  const path = summary.externalPath?.trim() ?? "";
  if (SPLUNK_BRAND_PATTERN.test(title) || SPLUNK_BRAND_PATTERN.test(path)) {
    return true;
  }
  return INTERNSHIP_LIST_TITLE_PATTERN.test(title);
}

export function createSplunkAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = parseWorkdayCareersUrl(
    source.sourceUrl?.trim() || SPLUNK_CISCO_CAREERS_URL,
    source.boardToken?.trim() || SPLUNK_CISCO_BOARD_TOKEN,
  );
  const resolvedSource =
    source.boardToken === board.site ? source : { ...source, boardToken: board.site };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const byPath = new Map<string, WorkdayJobPostingSummary>();

      for (const searchText of SPLUNK_WORKDAY_SEARCHES) {
        const batch = await fetchWorkdayJobSummaries(board, searchText);
        for (const summary of batch) {
          if (!isSplunkRelatedPosting(summary)) {
            continue;
          }
          const key = summary.externalPath?.trim();
          if (key) {
            byPath.set(key, summary);
          }
        }
      }

      const summaries = Array.from(byPath.values());
      const candidates = summaries.filter((summary) =>
        INTERNSHIP_LIST_TITLE_PATTERN.test(summary.title?.trim() ?? ""),
      );

      const enriched = await enrichWorkdayPostings(board, candidates);
      return parseWorkdayPostings(enriched, resolvedSource, board, summaries.length);
    },
  };
}
