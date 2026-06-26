import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, safeToIsoDate } from "./shared.ts";

/** Salesforce careers job board (Page Builder + static CDN snapshot). */
export const SALESFORCE_CAREERS_CDN_ORIGIN = "https://a.sfdcstatic.com/digital/xsf/careers";
export const SALESFORCE_JOBS_PAGE_ORIGIN = "https://www.salesforce.com/company/careers/jobs";
export const SALESFORCE_DEFAULT_ENV = "prod";
export const SALESFORCE_DEFAULT_SOURCE_URL = `${SALESFORCE_CAREERS_CDN_ORIGIN}/${SALESFORCE_DEFAULT_ENV}/jobs_2.json`;

/** @deprecated Legacy Umbraco RSS export — careers moved to static JSON on a.sfdcstatic.com. */
export const SALESFORCE_CAREERS_ORIGIN = "https://careers.salesforce.com";
export const SALESFORCE_DEFAULT_LOCALE = "en";
export const SALESFORCE_DEFAULT_RSS_URL = `${SALESFORCE_CAREERS_ORIGIN}/${SALESFORCE_DEFAULT_LOCALE}/jobs/xml/?rss=true`;

const VALID_SALESFORCE_ENVS = new Set(["prod", "qa", "uat"]);

/** List titles must look internship-related before classification. */
const INTERNSHIP_LIST_TITLE_PATTERN =
  /\bintern(?:ship|ships)?\b|\bco-?op\b|\bfellowship\b|\buniversity\b|\bapprentice\b/i;

export interface SalesforceBoardConfig {
  env: string;
  feedUrls: string[];
}

export interface SalesforceCareersJob {
  jobRequisitionRefId: string;
  jobPostingTitle: string;
  jobFamilyGroup: string | null;
  jobDescription: string;
  externalJobPostingStartDate: string | null;
  jobRequisitionPrimaryLocation: string | null;
  jobRequisitionAdditionalLocations: string | null;
  timeType: string | null;
  employeeType: string | null;
  externalJobPostingSite: string | null;
  structuredCountries?: string[];
  structuredRegions?: string[];
  structuredLocations?: string[];
}

/** @deprecated RSS-era job shape kept for Slack filter helpers during migration. */
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

interface SalesforceJobsFeed {
  Report_Entry?: SalesforceJobsFeedEntry[];
}

type SalesforceJobsFeedEntry = Record<string, unknown>;

export function createSalesforceAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveSalesforceBoard(source);
  const resolvedSource =
    source.boardToken === board.env && source.sourceUrl === board.feedUrls[0]
      ? source
      : { ...source, boardToken: board.env, sourceUrl: board.feedUrls[0] };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const { jobs, feedUrl } = await fetchSalesforceCareersJobs(board);
      const candidates = jobs.filter((job) =>
        INTERNSHIP_LIST_TITLE_PATTERN.test(job.jobPostingTitle.trim()),
      );
      return parseSalesforceCareersJobs(candidates, resolvedSource, jobs.length, feedUrl);
    },
  };
}

export function resolveSalesforceBoard(source: CompanySourceConfig): SalesforceBoardConfig {
  const env = normalizeSalesforceEnv(source.boardToken) ?? SALESFORCE_DEFAULT_ENV;
  const feedUrls = buildSalesforceJobsFeedUrls(env);

  return { env, feedUrls };
}

export function buildSalesforceJobsFeedUrls(env: string): string[] {
  const normalized = normalizeSalesforceEnv(env) ?? SALESFORCE_DEFAULT_ENV;
  const base = `${SALESFORCE_CAREERS_CDN_ORIGIN}/${normalized}`;
  return [
    `${base}/jobs_2.json`,
    `${base}/jobs_1.json`,
    `${base}/jobs_2_backup.json`,
    `${base}/jobs_1_backup.json`,
  ];
}

export function normalizeSalesforceEnv(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }
  if (VALID_SALESFORCE_ENVS.has(trimmed)) {
    return trimmed;
  }
  if (trimmed === "en" || trimmed === "en-us" || trimmed === "en_us") {
    return SALESFORCE_DEFAULT_ENV;
  }
  return null;
}

export function parseSalesforceJobsFeed(payload: unknown, url: string): SalesforceCareersJob[] {
  if (!payload || typeof payload !== "object") {
    throw new Error(`Salesforce careers feed was not JSON for ${url}`);
  }

  const entries = (payload as SalesforceJobsFeed).Report_Entry;
  if (!Array.isArray(entries)) {
    throw new Error(`Salesforce careers feed missing Report_Entry for ${url}`);
  }

  return entries
    .map((entry) => parseSalesforceFeedEntry(entry))
    .filter((job): job is SalesforceCareersJob => job !== null)
    .sort((left, right) => compareSalesforcePostedDates(right, left));
}

export function parseSalesforceFeedEntry(entry: SalesforceJobsFeedEntry): SalesforceCareersJob | null {
  const jobRequisitionRefId = readSalesforceFeedString(entry, "Job_Requisition_Ref_ID");
  const jobPostingTitle = readSalesforceFeedString(entry, "Job_Posting_Title");
  if (!jobRequisitionRefId || !jobPostingTitle) {
    return null;
  }

  const locations = readSalesforceFeedStringArray(entry.Locations);
  const countries = readSalesforceFeedStringArray(entry.Countries ?? entry.countries);
  const regions = readSalesforceFeedStringArray(entry.Regions ?? entry.regions);

  return {
    jobRequisitionRefId,
    jobPostingTitle,
    jobFamilyGroup: readSalesforceFeedString(entry, "Job_Family_Group"),
    jobDescription: readSalesforceFeedString(entry, "Job_Description") ?? "",
    externalJobPostingStartDate: safeToIsoDate(
      readSalesforceFeedString(entry, "External_Job_Posting_Start_Date"),
    ),
    jobRequisitionPrimaryLocation: readSalesforceFeedString(entry, "Job_Requisition_Primary_Location"),
    jobRequisitionAdditionalLocations: readSalesforceFeedString(
      entry,
      "Job_Requisition_Additional_Locations",
    ),
    timeType: readSalesforceFeedString(entry, "Time_Type"),
    employeeType: readSalesforceFeedString(entry, "Employee_Type"),
    externalJobPostingSite: readSalesforceFeedString(entry, "External_Job_Posting_Site"),
    ...(countries ? { structuredCountries: countries } : {}),
    ...(regions ? { structuredRegions: regions } : {}),
    ...(locations ? { structuredLocations: locations } : {}),
  };
}

export function slugifySalesforceJobTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function buildSalesforcePostingUrl(jobRequisitionRefId: string, jobPostingTitle: string): string {
  const slug = slugifySalesforceJobTitle(jobPostingTitle);
  return `${SALESFORCE_JOBS_PAGE_ORIGIN}/${jobRequisitionRefId}/${slug}/`;
}

export function formatSalesforceJobLocations(job: SalesforceCareersJob): string[] {
  const locations: string[] = [];
  const seen = new Set<string>();

  const add = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    if (!trimmed) {
      return;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    locations.push(trimmed);
  };

  add(job.jobRequisitionPrimaryLocation);
  for (const part of splitSalesforceLocationList(job.jobRequisitionAdditionalLocations)) {
    add(part);
  }
  for (const part of job.structuredLocations ?? []) {
    add(part);
  }

  return locations;
}

export function parseSalesforceCareersJobs(
  jobs: SalesforceCareersJob[],
  source: CompanySourceConfig,
  fetchedTotal: number,
  feedUrl: string,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const job of jobs) {
    const roleName = job.jobPostingTitle.trim();
    const postingUrl = buildSalesforcePostingUrl(job.jobRequisitionRefId, job.jobPostingTitle);
    const locations = formatSalesforceJobLocations(job);
    const description = job.jobDescription ?? "";

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      employmentType: job.employeeType ?? job.timeType,
      commitment: job.timeType,
      departments: job.jobFamilyGroup ? [job.jobFamilyGroup] : [],
      locations,
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
        description,
        atsDates: {
          publishedAt: job.externalJobPostingStartDate,
        },
      }),
    );
  }

  if (roles.length === 0 && fetchedTotal === 0) {
    throw new Error(`Salesforce careers feed returned zero jobs for ${feedUrl}`);
  }

  return buildRoleParseResult(fetchedTotal, roles, rejected);
}

export async function fetchSalesforceCareersJobs(
  board: SalesforceBoardConfig,
): Promise<{ jobs: SalesforceCareersJob[]; feedUrl: string }> {
  let lastError: Error | null = null;

  for (const feedUrl of board.feedUrls) {
    try {
      const res = await fetchJsonWithTimeout(feedUrl);
      if (!res.ok) {
        throw new Error(`Salesforce careers feed returned ${res.status} for ${feedUrl}`);
      }
      const payload = (await res.json()) as unknown;
      const jobs = parseSalesforceJobsFeed(payload, feedUrl);
      if (jobs.length > 0) {
        return { jobs, feedUrl };
      }
      lastError = new Error(`Salesforce careers feed returned zero jobs for ${feedUrl}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error("Salesforce careers feed fetch failed");
}

function splitSalesforceLocationList(value: string | null | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }
  return value
    .split(/[;|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function readSalesforceFeedString(
  entry: SalesforceJobsFeedEntry,
  field: string,
): string | null {
  const value = entry[field];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readSalesforceFeedStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const items = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function compareSalesforcePostedDates(left: SalesforceCareersJob, right: SalesforceCareersJob): number {
  const leftMs = Date.parse(left.externalJobPostingStartDate ?? "");
  const rightMs = Date.parse(right.externalJobPostingStartDate ?? "");
  const leftValue = Number.isNaN(leftMs) ? Number.NEGATIVE_INFINITY : leftMs;
  const rightValue = Number.isNaN(rightMs) ? Number.NEGATIVE_INFINITY : rightMs;
  return leftValue - rightValue;
}

/** @deprecated Legacy RSS URL builder — kept for Slack default constant compatibility. */
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
