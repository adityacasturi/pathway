import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, safeToIsoDate } from "./shared.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";

/** Public Jibe job search API on www.github.careers (iCIMS ATS backend). */
export const GITHUB_CAREERS_ORIGIN = "https://www.github.careers";
export const GITHUB_JOBS_API_URL = `${GITHUB_CAREERS_ORIGIN}/api/jobs`;
/** Fetch all listings; GitHub has no dedicated intern category in Jibe. */
export const GITHUB_DEFAULT_BOARD_TOKEN = "all";
export const GITHUB_DEFAULT_LOCALE = "en-us";

const GITHUB_PAGE_SIZE = 100;
const GITHUB_MAX_PAGES = 20;

/** List titles must look internship-related before classification. */
export interface GithubBoardConfig {
  jobsApiUrl: string;
  careersOrigin: string;
  fetchAllListings: boolean;
  internCategory: string | null;
  locale: string;
}

export interface GithubJobCategory {
  name?: string;
}

export interface GithubJobData {
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
  categories?: GithubJobCategory[];
}

export interface GithubJobPosting {
  data: GithubJobData;
}

export interface GithubJobsResponse {
  jobs?: GithubJobPosting[];
  count?: number;
  totalCount?: number;
  error?: string;
}

export function createGithubAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveGithubBoard(source);
  const resolvedSource =
    source.boardToken === board.internCategory || (board.fetchAllListings && source.boardToken === GITHUB_DEFAULT_BOARD_TOKEN)
      ? source
      : { ...source, boardToken: board.internCategory ?? GITHUB_DEFAULT_BOARD_TOKEN };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const jobs = await fetchAllGithubJobs(board);
      const candidates = jobs.filter((job) => isGithubListCandidate(job.data));
      return parseGithubJobs(candidates, resolvedSource, board, jobs.length);
    },
  };
}

export function resolveGithubBoard(source: CompanySourceConfig): GithubBoardConfig {
  const token = source.boardToken?.trim() || GITHUB_DEFAULT_BOARD_TOKEN;
  const fetchAllListings = token === "all" || token === "*";
  const internCategory = fetchAllListings ? null : token;
  const locale = parseGithubLocaleFromUrl(source.sourceUrl) ?? GITHUB_DEFAULT_LOCALE;
  const jobsApiUrl = isGithubJobsApiUrl(source.sourceUrl) ? source.sourceUrl.trim() : GITHUB_JOBS_API_URL;

  return {
    jobsApiUrl,
    careersOrigin: GITHUB_CAREERS_ORIGIN,
    fetchAllListings,
    internCategory,
    locale,
  };
}

export function isGithubJobsApiUrl(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    return (
      parsed.hostname.toLowerCase() === "www.github.careers" &&
      parsed.pathname.replace(/\/$/, "") === "/api/jobs"
    );
  } catch {
    return false;
  }
}

export function parseGithubLocaleFromUrl(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    const lang = parsed.searchParams.get("lang")?.trim();
    return lang || null;
  } catch {
    return null;
  }
}

export function buildGithubPostingUrl(board: GithubBoardConfig, job: GithubJobData): string | null {
  const slug = job.slug?.trim() || job.req_id?.trim();
  if (!slug) {
    return null;
  }

  const url = new URL(`${board.careersOrigin}/careers-home/jobs/${encodeURIComponent(slug)}`);
  url.searchParams.set("lang", board.locale);
  return url.toString();
}

export function formatGithubLocation(job: GithubJobData): string | null {
  const full = job.full_location?.trim() || job.short_location?.trim() || job.location_name?.trim();
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

export function githubJobDescription(job: GithubJobData): string {
  return [job.description, job.responsibilities, job.qualifications]
    .filter((part) => typeof part === "string" && part.trim())
    .join("\n");
}

export function parseGithubPostedDate(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }

  const parsed = new Date(value.trim());
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return safeToIsoDate(parsed);
}

export function parseGithubJobs(
  jobs: GithubJobPosting[],
  source: CompanySourceConfig,
  board: GithubBoardConfig,
  fetchedTotal: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const posting of jobs) {
    const job = posting.data;
    const roleName = job.title?.trim() || "";
    const descriptionHtml = githubJobDescription(job);
    const description = htmlToPlainText(descriptionHtml);
    const location = formatGithubLocation(job);
    const locations = location ? [location] : [];
    const postingUrl = buildGithubPostingUrl(board, job);

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

export function parseGithubJobsResponse(payload: unknown, url: string): GithubJobPosting[] {
  if (!payload || typeof payload !== "object") {
    throw new Error(`GitHub jobs response was not JSON for ${url}`);
  }

  const response = payload as GithubJobsResponse;
  if (response.error) {
    throw new Error(`GitHub jobs API returned error for ${url}: ${response.error}`);
  }

  if (!Array.isArray(response.jobs)) {
    throw new Error(`GitHub jobs response was not in expected format for ${url}`);
  }

  return response.jobs;
}

export function isGithubListCandidate(job: GithubJobData): boolean {
  const title = job.title?.trim() ?? "";
  if (INTERNSHIP_LIST_TITLE_PATTERN.test(title)) {
    return true;
  }

  return (job.categories ?? []).some((category) =>
    /intern|co-?op|student|campus/i.test(category.name?.trim() ?? ""),
  );
}

async function fetchAllGithubJobs(board: GithubBoardConfig): Promise<GithubJobPosting[]> {
  const jobs: GithubJobPosting[] = [];
  let offset = 0;

  for (let page = 0; page < GITHUB_MAX_PAGES; page++) {
    const batch = await fetchGithubJobsPage(board, offset);
    if (batch.length === 0) {
      break;
    }

    jobs.push(...batch);
    offset += batch.length;

    if (batch.length < GITHUB_PAGE_SIZE) {
      break;
    }
  }

  return jobs;
}

async function fetchGithubJobsPage(board: GithubBoardConfig, offset: number): Promise<GithubJobPosting[]> {
  const url = new URL(board.jobsApiUrl);
  url.searchParams.set("limit", String(GITHUB_PAGE_SIZE));
  url.searchParams.set("offset", String(offset));
  if (!board.fetchAllListings && board.internCategory) {
    url.searchParams.set("categories", board.internCategory);
  }

  const res = await fetchJsonWithTimeout(url.toString());
  if (!res.ok) {
    throw new Error(`GitHub jobs API returned ${res.status} for ${url.toString()}`);
  }

  const payload = (await res.json()) as unknown;
  return parseGithubJobsResponse(payload, url.toString());
}

