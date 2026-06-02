import { atsPublishDate } from "../posted-date.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, safeToIsoDate } from "./shared.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";

/** Public Jibe job search API on careers.sig.com (iCIMS ATS backend). */
export const SIG_CAREERS_ORIGIN = "https://careers.sig.com";
export const SIG_JOBS_API_URL = `${SIG_CAREERS_ORIGIN}/api/jobs`;
export const SIG_DEFAULT_CATEGORY = "Interns + Co-ops";
export const SIG_DEFAULT_LOCALE = "en-us";

const SIG_PAGE_SIZE = 100;
const SIG_MAX_PAGES = 20;

/** List titles must look internship-related before classification. */
export interface SigBoardConfig {
  jobsApiUrl: string;
  careersOrigin: string;
  internCategory: string;
  locale: string;
}

export interface SigJobCategory {
  name?: string;
}

export interface SigJobData {
  slug?: string;
  req_id?: string;
  title?: string;
  description?: string;
  responsibilities?: string;
  qualifications?: string;
  employment_type?: string;
  city?: string;
  state?: string;
  country?: string;
  country_code?: string;
  full_location?: string;
  short_location?: string;
  location_name?: string;
  posted_date?: string;
  apply_url?: string;
  categories?: SigJobCategory[];
}

export interface SigJobPosting {
  data: SigJobData;
}

export interface SigJobsResponse {
  jobs?: SigJobPosting[];
  count?: number;
  totalCount?: number;
  error?: string;
}

export function createSigAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveSigBoard(source);
  const resolvedSource =
    source.boardToken === board.internCategory ? source : { ...source, boardToken: board.internCategory };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const jobs = await fetchAllSigJobs(board);
      const candidates = jobs.filter((job) => isSigListCandidate(job.data));
      return parseSigJobs(candidates, resolvedSource, board, jobs.length);
    },
  };
}

export function resolveSigBoard(source: CompanySourceConfig): SigBoardConfig {
  const internCategory = source.boardToken?.trim() || SIG_DEFAULT_CATEGORY;
  const locale = parseSigLocaleFromUrl(source.sourceUrl) ?? SIG_DEFAULT_LOCALE;
  const jobsApiUrl = isSigJobsApiUrl(source.sourceUrl) ? source.sourceUrl.trim() : SIG_JOBS_API_URL;

  return {
    jobsApiUrl,
    careersOrigin: SIG_CAREERS_ORIGIN,
    internCategory,
    locale,
  };
}

export function isSigJobsApiUrl(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    return parsed.hostname.toLowerCase() === "careers.sig.com" && parsed.pathname.replace(/\/$/, "") === "/api/jobs";
  } catch {
    return false;
  }
}

export function parseSigLocaleFromUrl(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    const lang = parsed.searchParams.get("lang")?.trim();
    return lang || null;
  } catch {
    return null;
  }
}

export function buildSigPostingUrl(board: SigBoardConfig, job: SigJobData): string | null {
  const slug = job.slug?.trim() || job.req_id?.trim();
  if (!slug) {
    return null;
  }

  const url = new URL(`${board.careersOrigin}/jobs/${encodeURIComponent(slug)}`);
  url.searchParams.set("lang", board.locale);
  return url.toString();
}

export function formatSigLocation(job: SigJobData): string | null {
  const full = job.full_location?.trim() || job.short_location?.trim();
  if (full) {
    return full;
  }

  const city = job.city?.trim();
  const state = job.state?.trim();
  const country = job.country?.trim();
  const countryCode = job.country_code?.trim();

  if (city && state && country) {
    return `${city}, ${state}, ${country}`;
  }

  if (city && state) {
    return countryCode === "US" ? `${city}, ${state}, US` : `${city}, ${state}`;
  }

  if (city && country) {
    return `${city}, ${country}`;
  }

  return city || country || null;
}

export function sigJobDescription(job: SigJobData): string {
  return [job.description, job.responsibilities, job.qualifications]
    .filter((part) => typeof part === "string" && part.trim())
    .join("\n");
}

export function parseSigPostedDate(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }

  const parsed = new Date(value.trim());
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return safeToIsoDate(parsed);
}

export function parseSigJobs(
  jobs: SigJobPosting[],
  source: CompanySourceConfig,
  board: SigBoardConfig,
  fetchedTotal: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const posting of jobs) {
    const job = posting.data;
    const roleName = job.title?.trim() || "";
    const descriptionHtml = sigJobDescription(job);
    const description = htmlToPlainText(descriptionHtml);
    const location = formatSigLocation(job);
    const locations = location ? [location] : [];
    const postingUrl = buildSigPostingUrl(board, job);

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      employmentType: job.employment_type ?? null,
      departments: (job.categories ?? []).map((category) => category.name?.trim() ?? "").filter(Boolean),
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
        description: htmlToPlainText(descriptionHtml),
        dates: atsPublishDate(parseSigPostedDate(job.posted_date)),
      }),
    );
  }

  return buildRoleParseResult(fetchedTotal, roles, rejected);
}

export function parseSigJobsResponse(payload: unknown, url: string): SigJobPosting[] {
  if (!payload || typeof payload !== "object") {
    throw new Error(`SIG jobs response was not JSON for ${url}`);
  }

  const response = payload as SigJobsResponse;
  if (response.error) {
    throw new Error(`SIG jobs API returned error for ${url}: ${response.error}`);
  }

  if (!Array.isArray(response.jobs)) {
    throw new Error(`SIG jobs response was not in expected format for ${url}`);
  }

  return response.jobs;
}

function isSigListCandidate(job: SigJobData): boolean {
  const title = job.title?.trim() ?? "";
  if (INTERNSHIP_LIST_TITLE_PATTERN.test(title)) {
    return true;
  }

  return (job.categories ?? []).some((category) =>
    /intern|co-?op|student|campus/i.test(category.name?.trim() ?? ""),
  );
}

async function fetchAllSigJobs(board: SigBoardConfig): Promise<SigJobPosting[]> {
  const jobs: SigJobPosting[] = [];
  let offset = 0;

  for (let page = 0; page < SIG_MAX_PAGES; page++) {
    const batch = await fetchSigJobsPage(board, offset);
    if (batch.length === 0) {
      break;
    }

    jobs.push(...batch);
    offset += batch.length;

    if (batch.length < SIG_PAGE_SIZE) {
      break;
    }
  }

  return jobs;
}

async function fetchSigJobsPage(board: SigBoardConfig, offset: number): Promise<SigJobPosting[]> {
  const url = new URL(board.jobsApiUrl);
  url.searchParams.set("limit", String(SIG_PAGE_SIZE));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("categories", board.internCategory);

  const res = await fetchJsonWithTimeout(url.toString());
  if (!res.ok) {
    throw new Error(`SIG jobs API returned ${res.status} for ${url.toString()}`);
  }

  const payload = (await res.json()) as unknown;
  return parseSigJobsResponse(payload, url.toString());
}

