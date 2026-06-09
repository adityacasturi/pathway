import { stripHtml } from "../html-utils.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, resolveBoardToken } from "./shared.ts";

/**
 * LinkedIn employee recruiting is listed on linkedin.com/jobs (see careers.linkedin.com).
 * Public guest job pages: /jobs-guest/jobs/api/jobPosting/{id}
 *
 * Greenhouse board "linkedin" exists but hosts internal ATS test roles only — not used here.
 */
export const LINKEDIN_CAREERS_URL = "https://careers.linkedin.com/";
export const LINKEDIN_JOBS_SEARCH_ORIGIN = "https://www.linkedin.com";
export const LINKEDIN_DEFAULT_COMPANY_IDS = "1337,9202023,2561065,2587638,290903,39939";
export const LINKEDIN_GUEST_JOB_POSTING_URL = `${LINKEDIN_JOBS_SEARCH_ORIGIN}/jobs-guest/jobs/api/jobPosting`;

const LINKEDIN_SEARCH_KEYWORDS = [
  "software engineer intern",
  "engineering intern",
  "intern",
  "summer intern",
  "data science intern",
];

const LINKEDIN_SEARCH_PAGE_SIZE = 25;
const LINKEDIN_MAX_SEARCH_PAGES = 8;
const LINKEDIN_DETAIL_CONCURRENCY = 6;

const JOB_POSTING_URN_PATTERN = /urn:li:jobPosting:(\d+)/g;
const JOB_VIEW_PATH_PATTERN = /\/jobs\/view\/[^"?]+-at-linkedin-(\d+)/gi;

/** Prefetch detail when list context may be an internship. */
const LINKEDIN_DETAIL_PREFETCH_PATTERN =
  /\bintern(?:ship|ships)?\b|\bco-?op\b|\bapprentice\b|\buniversity\b|\bsummer\s+analyst\b/i;

const CRITERIA_PAIR_PATTERN =
  /<h3\s+class="description__job-criteria-subheader"[^>]*>\s*([\s\S]*?)\s*<\/h3>[\s\S]*?<span\s+class="description__job-criteria-text[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/span>/gi;

export interface LinkedInBoardConfig {
  companyIds: string[];
  defaultLocation: string;
}

export interface LinkedInJobSummary {
  jobId: string;
  title: string | null;
  postingUrl: string;
}

export interface LinkedInJobDetail {
  jobId: string;
  title: string;
  postingUrl: string;
  companyName: string | null;
  location: string | null;
  description: string;
  employmentType: string | null;
  seniorityLevel: string | null;
  jobFunction: string | null;
}

export function createLinkedInAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveLinkedInBoard(source);
  const resolvedSource =
    source.boardToken === board.companyIds.join(",") ? source : { ...source, boardToken: board.companyIds.join(",") };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const summaries = await fetchAllLinkedInSummaries(board);
      const candidates = summaries.filter((summary) => shouldPrefetchLinkedInDetail(summary));
      const enriched = await enrichLinkedInJobs(candidates);
      return parseLinkedInJobs(enriched, resolvedSource, summaries.length);
    },
  };
}

export function resolveLinkedInBoard(source: CompanySourceConfig): LinkedInBoardConfig {
  const token = resolveBoardToken(source, () => LINKEDIN_DEFAULT_COMPANY_IDS);
  const companyIds = token
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const defaultLocation = parseLinkedInSearchLocation(source.sourceUrl) ?? "United States";

  return {
    companyIds: companyIds.length > 0 ? companyIds : LINKEDIN_DEFAULT_COMPANY_IDS.split(","),
    defaultLocation,
  };
}

export function parseLinkedInSearchLocation(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl.trim());
    if (!parsed.hostname.toLowerCase().includes("linkedin.com")) {
      return null;
    }
    const location = parsed.searchParams.get("location")?.trim();
    return location || null;
  } catch {
    return null;
  }
}

export function buildLinkedInSearchUrl(
  board: LinkedInBoardConfig,
  keywords: string,
  start: number,
): string {
  const params = new URLSearchParams({
    keywords,
    f_C: board.companyIds.join(","),
    location: board.defaultLocation,
    start: String(start),
  });
  return `${LINKEDIN_JOBS_SEARCH_ORIGIN}/jobs/search/?${params.toString()}`;
}

export function buildLinkedInPostingUrl(jobId: string, slugTitle = "role"): string {
  const slug = slugTitle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${LINKEDIN_JOBS_SEARCH_ORIGIN}/jobs/view/${slug || "role"}-at-linkedin-${jobId}`;
}

export function parseLinkedInSearchJobIds(html: string): string[] {
  const ids = new Set<string>();

  for (const match of html.matchAll(JOB_POSTING_URN_PATTERN)) {
    const id = match[1]?.trim();
    if (id) {
      ids.add(id);
    }
  }

  for (const match of html.matchAll(JOB_VIEW_PATH_PATTERN)) {
    const id = match[1]?.trim();
    if (id) {
      ids.add(id);
    }
  }

  return [...ids];
}

export function parseLinkedInSearchSummaries(html: string): LinkedInJobSummary[] {
  const summaries: LinkedInJobSummary[] = [];

  for (const match of html.matchAll(
    /data-entity-urn="urn:li:jobPosting:(\d+)"[\s\S]*?\/jobs\/view\/([^"?]+)/g,
  )) {
    const jobId = match[1]?.trim();
    const path = match[2]?.trim();
    if (!jobId) {
      continue;
    }

    const postingUrl = `${LINKEDIN_JOBS_SEARCH_ORIGIN}/jobs/view/${path}`;
    const title = decodeLinkedInSlugTitle(path);
    summaries.push({ jobId, title, postingUrl });
  }

  if (summaries.length > 0) {
    return dedupeSummaries(summaries);
  }

  return parseLinkedInSearchJobIds(html).map((jobId) => ({
    jobId,
    title: null,
    postingUrl: buildLinkedInPostingUrl(jobId),
  }));
}

export function parseLinkedInJobPostingHtml(html: string, jobId: string): LinkedInJobDetail | null {
  const title =
    stripHtml(html.match(/<h2[^>]*class="[^"]*topcard__title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? "") ||
    stripHtml(html.match(/<h2[^>]*class="[^"]*top-card-layout__title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? "");

  if (!title) {
    return null;
  }

  const companyName = parseLinkedInCompanyName(html);
  const location = parseLinkedInLocation(html);
  const criteria = parseLinkedInCriteria(html);
  const descriptionHtml = html.match(
    /<div\s+class="description__text description__text--rich"[^>]*>([\s\S]*?)<\/div>/i,
  )?.[1];
  const description = descriptionHtml ? htmlToPlainText(descriptionHtml) : "";

  const canonicalUrl =
    html.match(/href="(https:\/\/www\.linkedin\.com\/jobs\/view\/[^"]+)"/i)?.[1]?.split("?")[0] ??
    buildLinkedInPostingUrl(jobId, title);

  return {
    jobId,
    title,
    postingUrl: canonicalUrl,
    companyName,
    location,
    description,
    employmentType: criteria.get("employment type") ?? null,
    seniorityLevel: criteria.get("seniority level") ?? null,
    jobFunction: criteria.get("job function") ?? null,
  };
}

export function parseLinkedInJobs(
  details: LinkedInJobDetail[],
  source: CompanySourceConfig,
  fetchedCount: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const detail of details) {
    const roleName = detail.title.trim();
    const postingUrl = detail.postingUrl.trim();
    const locations = detail.location ? [detail.location] : [];
    const departments = [detail.jobFunction, detail.seniorityLevel, detail.employmentType].filter(
      (value): value is string => Boolean(value?.trim()),
    );

    const classification = classifyForSource(source, {
      title: roleName,
      description: buildLinkedInClassificationDescription(detail),
      employmentType: detail.employmentType,
      team: detail.jobFunction,
      departments,
      locations,
    });

    if (!classification.include) {
      if (roleName) {
        rejected.push({ title: roleName, reason: classification.reason });
      }
      continue;
    }

    if (!postingUrl || !isHttpUrl(postingUrl)) {
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
        description: buildLinkedInClassificationDescription(detail),
      }),
    );
  }

  return buildRoleParseResult(fetchedCount, roles, rejected);
}

export function shouldPrefetchLinkedInDetail(summary: LinkedInJobSummary): boolean {
  const haystack = [summary.title, summary.postingUrl].filter(Boolean).join(" ");
  return LINKEDIN_DETAIL_PREFETCH_PATTERN.test(haystack);
}

export function isLinkedInEmployer(companyName: string | null, expected = "LinkedIn"): boolean {
  if (!companyName?.trim()) {
    return true;
  }
  return companyName.trim().toLowerCase() === expected.trim().toLowerCase();
}

async function fetchAllLinkedInSummaries(board: LinkedInBoardConfig): Promise<LinkedInJobSummary[]> {
  const byId = new Map<string, LinkedInJobSummary>();

  for (const keywords of LINKEDIN_SEARCH_KEYWORDS) {
    for (let page = 0; page < LINKEDIN_MAX_SEARCH_PAGES; page += 1) {
      const start = page * LINKEDIN_SEARCH_PAGE_SIZE;
      const url = buildLinkedInSearchUrl(board, keywords, start);
      const html = await fetchLinkedInHtml(url);
      const batch = parseLinkedInSearchSummaries(html);

      for (const summary of batch) {
        byId.set(summary.jobId, summary);
      }

      if (batch.length < LINKEDIN_SEARCH_PAGE_SIZE) {
        break;
      }
    }
  }

  return [...byId.values()];
}

async function enrichLinkedInJobs(summaries: LinkedInJobSummary[]): Promise<LinkedInJobDetail[]> {
  const results: LinkedInJobDetail[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < summaries.length) {
      const current = summaries[index];
      index += 1;
      if (!current) {
        continue;
      }

      const html = await fetchLinkedInHtml(`${LINKEDIN_GUEST_JOB_POSTING_URL}/${current.jobId}`);
      const detail = parseLinkedInJobPostingHtml(html, current.jobId);
      if (!detail) {
        continue;
      }
      if (!isLinkedInEmployer(detail.companyName)) {
        continue;
      }
      results.push(detail);
    }
  }

  const workers = Array.from({ length: Math.min(LINKEDIN_DETAIL_CONCURRENCY, summaries.length) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return results;
}

async function fetchLinkedInHtml(url: string): Promise<string> {
  const res = await fetchJsonWithTimeout(url, {
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) {
    throw new Error(`LinkedIn careers returned ${res.status} for ${url}`);
  }
  return res.text();
}

function parseLinkedInCompanyName(html: string): string | null {
  const match = html.match(
    /<a[^>]*class="[^"]*topcard__org-name-link[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/a>/i,
  );
  return match ? stripHtml(match[1] ?? "") : null;
}

function parseLinkedInLocation(html: string): string | null {
  const flavors = [...html.matchAll(/<span\s+class="topcard__flavor[^"]*"[^>]*>([\s\S]*?)<\/span>/gi)]
    .map((match) => stripHtml(match[1] ?? ""))
    .filter(Boolean);

  for (const flavor of flavors) {
    if (/linkedin/i.test(flavor)) {
      continue;
    }
    if (flavor.length > 2) {
      return flavor;
    }
  }

  return null;
}

function parseLinkedInCriteria(html: string): Map<string, string> {
  const criteria = new Map<string, string>();
  for (const match of html.matchAll(CRITERIA_PAIR_PATTERN)) {
    const label = stripHtml(match[1] ?? "").toLowerCase();
    const value = stripHtml(match[2] ?? "");
    if (label && value) {
      criteria.set(label, value);
    }
  }
  return criteria;
}

function buildLinkedInClassificationDescription(detail: LinkedInJobDetail): string {
  const boost: string[] = [];
  if (/\binternship\b/i.test(detail.employmentType ?? "")) {
    boost.push("internship program");
  }
  if (/\bintern\b/i.test(detail.title)) {
    boost.push("engineering internship");
  }
  if (detail.jobFunction && /engineering|technology|software/i.test(detail.jobFunction)) {
    boost.push("engineering technology internship");
  }

  return [detail.description, ...boost].filter(Boolean).join("\n");
}

function decodeLinkedInSlugTitle(path: string): string | null {
  const atIndex = path.lastIndexOf("-at-linkedin-");
  if (atIndex <= 0) {
    return null;
  }
  const slug = path.slice(0, atIndex);
  return slug
    .split("-")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ""))
    .join(" ");
}

function dedupeSummaries(summaries: LinkedInJobSummary[]): LinkedInJobSummary[] {
  const byId = new Map<string, LinkedInJobSummary>();
  for (const summary of summaries) {
    byId.set(summary.jobId, summary);
  }
  return [...byId.values()];
}

