import { atsPublishDate } from "../posted-date.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, safeToIsoDate } from "./shared.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";

/** Public Jibe job search API on careers.rivian.com (iCIMS ATS backend). */
export const RIVIAN_CAREERS_ORIGIN = "https://careers.rivian.com";
export const RIVIAN_JOBS_API_URL = `${RIVIAN_CAREERS_ORIGIN}/api/jobs`;
export const RIVIAN_DEFAULT_CATEGORY = "Internships";
export const RIVIAN_DEFAULT_LOCALE = "en-us";

const RIVIAN_PAGE_SIZE = 100;
const RIVIAN_MAX_PAGES = 20;

/** List titles must look internship-related before classification. */
export interface RivianBoardConfig {
  jobsApiUrl: string;
  careersOrigin: string;
  internCategory: string;
  locale: string;
}

export interface RivianJobCategory {
  name?: string;
}

export interface RivianJobData {
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
  categories?: RivianJobCategory[];
}

export interface RivianJobPosting {
  data: RivianJobData;
}

export interface RivianJobsResponse {
  jobs?: RivianJobPosting[];
  count?: number;
  totalCount?: number;
  error?: string;
}

export function createRivianAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveRivianBoard(source);
  const resolvedSource =
    source.boardToken === board.internCategory ? source : { ...source, boardToken: board.internCategory };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const jobs = await fetchAllRivianJobs(board);
      const candidates = jobs.filter((job) => isRivianListCandidate(job.data));
      return parseRivianJobs(candidates, resolvedSource, board, jobs.length);
    },
  };
}

export function resolveRivianBoard(source: CompanySourceConfig): RivianBoardConfig {
  const internCategory = source.boardToken?.trim() || RIVIAN_DEFAULT_CATEGORY;
  const locale = parseRivianLocaleFromUrl(source.sourceUrl) ?? RIVIAN_DEFAULT_LOCALE;
  const jobsApiUrl = isRivianJobsApiUrl(source.sourceUrl) ? source.sourceUrl.trim() : RIVIAN_JOBS_API_URL;

  return {
    jobsApiUrl,
    careersOrigin: RIVIAN_CAREERS_ORIGIN,
    internCategory,
    locale,
  };
}

export function isRivianJobsApiUrl(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    return (
      parsed.hostname.toLowerCase() === "careers.rivian.com" && parsed.pathname.replace(/\/$/, "") === "/api/jobs"
    );
  } catch {
    return false;
  }
}

export function parseRivianLocaleFromUrl(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    const lang = parsed.searchParams.get("lang")?.trim();
    return lang || null;
  } catch {
    return null;
  }
}

export function buildRivianPostingUrl(board: RivianBoardConfig, job: RivianJobData): string | null {
  const slug = job.slug?.trim() || job.req_id?.trim();
  if (!slug) {
    return null;
  }

  const url = new URL(`${board.careersOrigin}/jobs/${encodeURIComponent(slug)}`);
  url.searchParams.set("lang", board.locale);
  return url.toString();
}

export function formatRivianLocation(job: RivianJobData): string | null {
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

export function rivianJobDescription(job: RivianJobData): string {
  return [job.description, job.responsibilities, job.qualifications]
    .filter((part) => typeof part === "string" && part.trim())
    .join("\n");
}

export function parseRivianPostedDate(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }

  const parsed = new Date(value.trim());
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return safeToIsoDate(parsed);
}

export function parseRivianJobs(
  jobs: RivianJobPosting[],
  source: CompanySourceConfig,
  board: RivianBoardConfig,
  fetchedTotal: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const posting of jobs) {
    const job = posting.data;
    const roleName = job.title?.trim() || "";
    const descriptionHtml = rivianJobDescription(job);
    const description = htmlToPlainText(descriptionHtml);
    const location = formatRivianLocation(job);
    const locations = location ? [location] : [];
    const postingUrl = buildRivianPostingUrl(board, job);

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
        dates: atsPublishDate(parseRivianPostedDate(job.posted_date)),
      }),
    );
  }

  return buildRoleParseResult(fetchedTotal, roles, rejected);
}

export function parseRivianJobsResponse(payload: unknown, url: string): RivianJobPosting[] {
  if (!payload || typeof payload !== "object") {
    throw new Error(`Rivian jobs response was not JSON for ${url}`);
  }

  const response = payload as RivianJobsResponse;
  if (response.error) {
    throw new Error(`Rivian jobs API returned error for ${url}: ${response.error}`);
  }

  if (!Array.isArray(response.jobs)) {
    throw new Error(`Rivian jobs response was not in expected format for ${url}`);
  }

  return response.jobs;
}

function isRivianListCandidate(job: RivianJobData): boolean {
  const title = job.title?.trim() ?? "";
  if (INTERNSHIP_LIST_TITLE_PATTERN.test(title)) {
    return true;
  }

  return (job.categories ?? []).some((category) =>
    /intern|co-?op|student|campus/i.test(category.name?.trim() ?? ""),
  );
}

async function fetchAllRivianJobs(board: RivianBoardConfig): Promise<RivianJobPosting[]> {
  const jobs: RivianJobPosting[] = [];
  let offset = 0;

  for (let page = 0; page < RIVIAN_MAX_PAGES; page++) {
    const batch = await fetchRivianJobsPage(board, offset);
    if (batch.length === 0) {
      break;
    }

    jobs.push(...batch);
    offset += batch.length;

    if (batch.length < RIVIAN_PAGE_SIZE) {
      break;
    }
  }

  return jobs;
}

async function fetchRivianJobsPage(board: RivianBoardConfig, offset: number): Promise<RivianJobPosting[]> {
  const url = new URL(board.jobsApiUrl);
  url.searchParams.set("limit", String(RIVIAN_PAGE_SIZE));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("categories", board.internCategory);

  const res = await fetchJsonWithTimeout(url.toString());
  if (!res.ok) {
    throw new Error(`Rivian jobs API returned ${res.status} for ${url.toString()}`);
  }

  const payload = (await res.json()) as unknown;
  return parseRivianJobsResponse(payload, url.toString());
}

