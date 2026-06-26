import type { CompanySourceConfig, ScrapeAdapter } from "../types.ts";
import {
  fetchSalesforceCareersJobs,
  parseSalesforceCareersJobs,
  resolveSalesforceBoard,
  SALESFORCE_DEFAULT_SOURCE_URL,
  type SalesforceCareersJob,
} from "./salesforce.ts";

/** Slack listings are published on Salesforce careers (Slack is a Salesforce company). */
export const SLACK_SALESFORCE_SOURCE_URL = SALESFORCE_DEFAULT_SOURCE_URL;

const SLACK_BRAND_PATTERN = /\bslack\b/i;

export function isSlackRelatedJob(job: Pick<SalesforceCareersJob, "jobPostingTitle" | "externalJobPostingSite">): boolean {
  const title = job.jobPostingTitle.trim();
  let path = "";
  try {
    path = new URL(job.externalJobPostingSite ?? "").pathname.toLowerCase();
  } catch {
    path = "";
  }

  if (path.includes("slack")) {
    return true;
  }

  if (!SLACK_BRAND_PATTERN.test(title)) {
    return false;
  }

  return (
    /(?:^|[-\s(,])slack\b/i.test(title) ||
    /\bslack(?:\s+cloud|\s+self|\s+\(|[-\s])/i.test(title) ||
    /[-\s]slack(?:\s|$|[-,])/i.test(title)
  );
}

export function createSlackAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveSalesforceBoard({
    ...source,
    sourceUrl: source.sourceUrl?.trim() || SLACK_SALESFORCE_SOURCE_URL,
    boardToken: source.boardToken?.trim() || "prod",
  });
  const resolvedSource = {
    ...source,
    boardToken: board.env,
    sourceUrl: board.feedUrls[0],
  };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const { jobs, feedUrl } = await fetchSalesforceCareersJobs(board);
      const slackJobs = jobs.filter(isSlackRelatedJob);
      return parseSalesforceCareersJobs(slackJobs, resolvedSource, jobs.length, feedUrl);
    },
  };
}
