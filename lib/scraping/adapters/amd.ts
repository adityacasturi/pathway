import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, safeToIsoDate } from "./shared.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";

/** Public Jibe job search API on careers.amd.com (iCIMS ATS backend). */
export const AMD_CAREERS_ORIGIN = "https://careers.amd.com";
export const AMD_JOBS_API_URL = `${AMD_CAREERS_ORIGIN}/api/jobs`;
export const AMD_DEFAULT_CATEGORY = "Student / Intern / Temp";
export const AMD_DEFAULT_LOCALE = "en-us";

const AMD_PAGE_SIZE = 100;
const AMD_MAX_PAGES = 20;

/** List titles must look internship-related before classification. */
export interface AmdBoardConfig {
  jobsApiUrl: string;
  careersOrigin: string;
  internCategory: string;
  locale: string;
}

export interface AmdJobCategory {
  name?: string;
}

export interface AmdJobData {
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
  posted_date?: string;
  apply_url?: string;
  categories?: AmdJobCategory[];
}

export interface AmdJobPosting {
  data: AmdJobData;
}

export interface AmdJobsResponse {
  jobs?: AmdJobPosting[];
  count?: number;
  totalCount?: number;
  error?: string;
}

export function createAmdAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveAmdBoard(source);
  const resolvedSource =
    source.boardToken === board.internCategory ? source : { ...source, boardToken: board.internCategory };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const jobs = await fetchAllAmdJobs(board);
      const candidates = jobs.filter((job) => isAmdListCandidate(job.data));
      return parseAmdJobs(candidates, resolvedSource, board, jobs.length);
    },
  };
}

export function resolveAmdBoard(source: CompanySourceConfig): AmdBoardConfig {
  const internCategory = source.boardToken?.trim() || AMD_DEFAULT_CATEGORY;
  const locale = parseAmdLocaleFromUrl(source.sourceUrl) ?? AMD_DEFAULT_LOCALE;
  const jobsApiUrl = isAmdJobsApiUrl(source.sourceUrl) ? source.sourceUrl.trim() : AMD_JOBS_API_URL;

  return {
    jobsApiUrl,
    careersOrigin: AMD_CAREERS_ORIGIN,
    internCategory,
    locale,
  };
}

export function isAmdJobsApiUrl(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    return (
      parsed.hostname.toLowerCase() === "careers.amd.com" && parsed.pathname.replace(/\/$/, "") === "/api/jobs"
    );
  } catch {
    return false;
  }
}

export function parseAmdLocaleFromUrl(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    const lang = parsed.searchParams.get("lang")?.trim();
    return lang || null;
  } catch {
    return null;
  }
}

export function buildAmdPostingUrl(board: AmdBoardConfig, job: AmdJobData): string | null {
  const slug = job.slug?.trim() || job.req_id?.trim();
  if (!slug) {
    return null;
  }

  const url = new URL(`${board.careersOrigin}/careers-home/jobs/${encodeURIComponent(slug)}`);
  url.searchParams.set("lang", board.locale);
  return url.toString();
}

export function formatAmdLocation(job: AmdJobData): string | null {
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

export function amdJobDescription(job: AmdJobData): string {
  return [job.description, job.responsibilities, job.qualifications]
    .filter((part) => typeof part === "string" && part.trim())
    .join("\n");
}

export function parseAmdPostedDate(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }

  const parsed = new Date(value.trim());
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return safeToIsoDate(parsed);
}

export function parseAmdJobs(
  jobs: AmdJobPosting[],
  source: CompanySourceConfig,
  board: AmdBoardConfig,
  fetchedTotal: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const posting of jobs) {
    const job = posting.data;
    const roleName = job.title?.trim() || "";
    const descriptionHtml = amdJobDescription(job);
    const description = htmlToPlainText(descriptionHtml);
    const location = formatAmdLocation(job);
    const locations = location ? [location] : [];
    const postingUrl = buildAmdPostingUrl(board, job);

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
      }),
    );
  }

  return buildRoleParseResult(fetchedTotal, roles, rejected);
}

export function parseAmdJobsResponse(payload: unknown, url: string): AmdJobPosting[] {
  if (!payload || typeof payload !== "object") {
    throw new Error(`AMD jobs response was not JSON for ${url}`);
  }

  const response = payload as AmdJobsResponse;
  if (response.error) {
    throw new Error(`AMD jobs API returned error for ${url}: ${response.error}`);
  }

  if (!Array.isArray(response.jobs)) {
    throw new Error(`AMD jobs response was not in expected format for ${url}`);
  }

  return response.jobs;
}

function isAmdListCandidate(job: AmdJobData): boolean {
  const title = job.title?.trim() ?? "";
  if (INTERNSHIP_LIST_TITLE_PATTERN.test(title)) {
    return true;
  }

  return (job.categories ?? []).some((category) =>
    /student|intern|temp/i.test(category.name?.trim() ?? ""),
  );
}

async function fetchAllAmdJobs(board: AmdBoardConfig): Promise<AmdJobPosting[]> {
  const jobs: AmdJobPosting[] = [];
  let offset = 0;

  for (let page = 0; page < AMD_MAX_PAGES; page++) {
    const batch = await fetchAmdJobsPage(board, offset);
    if (batch.length === 0) {
      break;
    }

    jobs.push(...batch);
    offset += batch.length;

    if (batch.length < AMD_PAGE_SIZE) {
      break;
    }
  }

  return jobs;
}

async function fetchAmdJobsPage(board: AmdBoardConfig, offset: number): Promise<AmdJobPosting[]> {
  const url = new URL(board.jobsApiUrl);
  url.searchParams.set("limit", String(AMD_PAGE_SIZE));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("categories", board.internCategory);

  const res = await fetchJsonWithTimeout(url.toString());
  if (!res.ok) {
    throw new Error(`AMD jobs API returned ${res.status} for ${url.toString()}`);
  }

  const payload = (await res.json()) as unknown;
  return parseAmdJobsResponse(payload, url.toString());
}

