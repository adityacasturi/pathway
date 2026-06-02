import { atsPublishDate } from "../posted-date.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, safeToIsoDate } from "./shared.ts";

/** Public Umbraco/Phenom RSS export (all open roles for a locale). */
export const SALESFORCE_CAREERS_ORIGIN = "https://careers.salesforce.com";
export const SALESFORCE_DEFAULT_LOCALE = "en";
export const SALESFORCE_DEFAULT_RSS_URL = `${SALESFORCE_CAREERS_ORIGIN}/${SALESFORCE_DEFAULT_LOCALE}/jobs/xml/?rss=true`;

const JOB_BLOCK_PATTERN = /<job>([\s\S]*?)<\/job>/gi;

/** List titles must look internship-related before classification. */
const INTERNSHIP_LIST_TITLE_PATTERN =
  /\bintern(?:ship|ships)?\b|\bco-?op\b|\bfellowship\b|\buniversity\b|\bapprentice\b/i;

export interface SalesforceBoardConfig {
  locale: string;
  rssUrl: string;
}

export interface SalesforceRssJob {
  title: string;
  url: string;
  description: string;
  city: string | null;
  state: string | null;
  country: string | null;
  datePosted: string | null;
  jobType: string | null;
  category: string | null;
}

export function createSalesforceAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveSalesforceBoard(source);
  const resolvedSource =
    source.boardToken === board.locale && source.sourceUrl === board.rssUrl
      ? source
      : { ...source, boardToken: board.locale, sourceUrl: board.rssUrl };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const xml = await fetchSalesforceRss(board.rssUrl);
      const jobs = parseSalesforceRssXml(xml);
      const candidates = jobs.filter((job) =>
        INTERNSHIP_LIST_TITLE_PATTERN.test(job.title.trim()),
      );
      return parseSalesforceJobs(candidates, resolvedSource, jobs.length);
    },
  };
}

export function resolveSalesforceBoard(source: CompanySourceConfig): SalesforceBoardConfig {
  const locale = normalizeSalesforceLocale(source.boardToken) ?? parseSalesforceLocaleFromUrl(source.sourceUrl) ?? SALESFORCE_DEFAULT_LOCALE;
  const rssUrl = normalizeSalesforceRssUrl(source.sourceUrl, locale);

  return { locale, rssUrl };
}

export function buildSalesforceRssUrl(locale: string): string {
  const normalized = normalizeSalesforceLocale(locale) ?? SALESFORCE_DEFAULT_LOCALE;
  return `${SALESFORCE_CAREERS_ORIGIN}/${normalized}/jobs/xml/?rss=true`;
}

export function normalizeSalesforceRssUrl(sourceUrl: string, locale: string): string {
  const trimmed = sourceUrl.trim();
  if (trimmed && isSalesforceRssUrl(trimmed)) {
    return trimmed;
  }
  return buildSalesforceRssUrl(locale);
}

export function isSalesforceRssUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.toLowerCase() === "careers.salesforce.com" &&
      /\/jobs\/xml\/?$/i.test(parsed.pathname.replace(/\/$/, "")) &&
      parsed.searchParams.get("rss") === "true"
    );
  } catch {
    return false;
  }
}

export function parseSalesforceLocaleFromUrl(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.hostname.toLowerCase() !== "careers.salesforce.com") {
      return null;
    }
    const segments = parsed.pathname
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean);
    return segments[0] ? normalizeSalesforceLocale(segments[0]) : null;
  } catch {
    return null;
  }
}

export function parseSalesforceRssXml(xml: string): SalesforceRssJob[] {
  const jobs: SalesforceRssJob[] = [];

  for (const match of xml.matchAll(JOB_BLOCK_PATTERN)) {
    const block = match[1] ?? "";
    const title = readSalesforceRssField(block, "title");
    const url = readSalesforceRssField(block, "url");
    if (!title || !url) {
      continue;
    }

    jobs.push({
      title,
      url,
      description: readSalesforceRssField(block, "description") ?? "",
      city: readSalesforceRssField(block, "city"),
      state: readSalesforceRssField(block, "state"),
      country: readSalesforceRssField(block, "country"),
      datePosted: safeToIsoDate(readSalesforceRssField(block, "date")),
      jobType: readSalesforceRssField(block, "jobtype"),
      category: readSalesforceRssField(block, "category"),
    });
  }

  return jobs;
}

export function formatSalesforceLocation(
  city: string | null | undefined,
  state: string | null | undefined,
  country: string | null | undefined,
): string | null {
  const parts = [city?.trim(), state?.trim(), country?.trim()].filter(Boolean) as string[];
  if (parts.length === 0) {
    return null;
  }
  return parts.join(", ");
}

export function parseSalesforceJobs(
  jobs: SalesforceRssJob[],
  source: CompanySourceConfig,
  fetchedTotal: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const job of jobs) {
    const roleName = job.title.trim();
    const postingUrl = job.url.trim();
    const location = formatSalesforceLocation(job.city, job.state, job.country);
    const description = job.description ?? "";

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      employmentType: job.jobType,
      commitment: job.category,
      locations: location ? [location] : [],
    });

    if (!classification.include) {
      rejected.push({ title: roleName, reason: classification.reason });
      continue;
    }

    if (!isHttpUrl(postingUrl)) {
      rejected.push({ title: roleName, reason: "invalid_url" });
      continue;
    }

    roles.push(
      buildScrapedRole({
        postingUrl,
        roleName,
        companyName: source.companyName,
        companySlug: source.companySlug,
        classification,
        description: job.description ?? "",
        dates: atsPublishDate(safeToIsoDate(job.datePosted)),
      }),
    );
  }

  return buildRoleParseResult(fetchedTotal, roles, rejected);
}

function readSalesforceRssField(block: string, field: string): string | null {
  const cdataPattern = new RegExp(`<${field}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${field}>`, "i");
  const cdataMatch = block.match(cdataPattern);
  if (cdataMatch) {
    const value = cdataMatch[1]?.trim() ?? "";
    return value.length > 0 ? value : null;
  }

  const plainPattern = new RegExp(`<${field}>\\s*([^<]*)\\s*</${field}>`, "i");
  const plainMatch = block.match(plainPattern);
  if (!plainMatch) {
    return null;
  }
  const value = plainMatch[1]?.trim() ?? "";
  return value.length > 0 ? value : null;
}

function normalizeSalesforceLocale(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }
  if (trimmed === "en-us" || trimmed === "en_us") {
    return "en";
  }
  const pathLocale = trimmed.split(/[/?#]/)[0];
  return pathLocale.length > 0 ? pathLocale : null;
}

async function fetchSalesforceRss(rssUrl: string): Promise<string> {
  const res = await fetchJsonWithTimeout(rssUrl, {
    headers: {
      accept: "application/rss+xml, application/xml, text/xml, */*",
    },
  });

  if (!res.ok) {
    throw new Error(`Salesforce RSS returned ${res.status} for ${rssUrl}`);
  }

  return res.text();
}

