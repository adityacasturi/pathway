import type { CompanySourceConfig, ScrapeAdapter } from "../types.ts";
import {
  buildSalesforceRssUrl,
  parseSalesforceJobs,
  parseSalesforceRssXml,
  resolveSalesforceBoard,
  type SalesforceRssJob,
} from "./salesforce.ts";
import { fetchJsonWithTimeout } from "./shared.ts";

/** Slack listings are published on Salesforce careers (Slack is a Salesforce company). */
export const SLACK_SALESFORCE_RSS_URL = buildSalesforceRssUrl("en");

const SLACK_BRAND_PATTERN = /\bslack\b/i;

export function isSlackRelatedJob(job: SalesforceRssJob): boolean {
  const title = job.title.trim();
  let path = "";
  try {
    path = new URL(job.url).pathname.toLowerCase();
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
    sourceUrl: source.sourceUrl?.trim() || SLACK_SALESFORCE_RSS_URL,
    boardToken: source.boardToken?.trim() || "en",
  });
  const resolvedSource = {
    ...source,
    boardToken: board.locale,
    sourceUrl: board.rssUrl,
  };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const res = await fetchJsonWithTimeout(board.rssUrl, {
        headers: {
          accept: "application/rss+xml, application/xml, text/xml, */*",
        },
      });
      if (!res.ok) {
        throw new Error(`Salesforce RSS returned ${res.status} for ${board.rssUrl}`);
      }
      const xml = await res.text();
      const jobs = parseSalesforceRssXml(xml);
      const slackJobs = jobs.filter(isSlackRelatedJob);
      return parseSalesforceJobs(slackJobs, resolvedSource, jobs.length);
    },
  };
}
