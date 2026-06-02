import { atsPublishWithModified } from "../posted-date.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { atsJsonHeaders, fetchJsonWithTimeout, isHttpUrl, safeToIsoDate } from "./shared.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";

/**
 * Wayfair careers: Brightspot shell + internal job_search_data JSON API.
 * Greenhouse boards-api token "wayfair" is not published; apply links use Avature.
 */
export const WAYFAIR_CAREERS_ORIGIN = "https://www.wayfair.com/careers";
export const WAYFAIR_JOB_SEARCH_URL = "https://www.wayfair.com/a/careers/careers/job_search_data";
export const WAYFAIR_DEFAULT_BOARD_TOKEN = "wayfair";

export interface WayfairBoardConfig {
  careersOrigin: string;
  jobSearchUrl: string;
}

export interface WayfairJobLocation {
  name?: string;
  city?: string;
  state?: string;
  country?: string;
  countryId?: number;
}

export interface WayfairJobSummary {
  id?: number;
  eid?: string;
  requisitionId?: string;
  title?: string;
  description?: string;
  briefDescription?: string;
  applyLink?: string;
  structuredDataApplyLink?: string;
  location?: WayfairJobLocation | null;
  createdDate?: string;
  lastUpdatedDate?: string;
  teamName?: string;
  category?: { name?: string } | null;
  jobTypeDisplayName?: string;
  isActive?: boolean;
}

interface WayfairJobSearchResponse {
  jobListData?: WayfairJobSummary[];
}

export function createWayfairAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveWayfairBoard(source);
  const resolvedSource =
    source.sourceUrl === board.jobSearchUrl ? source : { ...source, sourceUrl: board.jobSearchUrl };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const jobs = await fetchWayfairJobList(board);
      const candidates = jobs.filter((job) => isWayfairListCandidate(job));
      return parseWayfairJobs(candidates, resolvedSource, jobs.length);
    },
  };
}

export function resolveWayfairBoard(source: CompanySourceConfig): WayfairBoardConfig {
  const jobSearchUrl = normalizeWayfairJobSearchUrl(source.sourceUrl);
  const careersOrigin = parseWayfairCareersOrigin(source.sourceUrl) ?? WAYFAIR_CAREERS_ORIGIN;

  return { careersOrigin, jobSearchUrl };
}

export function normalizeWayfairJobSearchUrl(sourceUrl: string): string {
  const trimmed = sourceUrl.trim();
  if (trimmed.includes("/a/careers/careers/job_search_data")) {
    return trimmed;
  }
  return WAYFAIR_JOB_SEARCH_URL;
}

export function parseWayfairCareersOrigin(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.hostname.toLowerCase() === "www.wayfair.com") {
      return `${parsed.protocol}//${parsed.host}/careers`;
    }
    return null;
  } catch {
    return null;
  }
}

export function parseWayfairJobSearchResponse(payload: unknown, url: string): WayfairJobSummary[] {
  if (!payload || typeof payload !== "object") {
    throw new Error(`Wayfair job_search_data response was not JSON for ${url}`);
  }

  const jobs = (payload as WayfairJobSearchResponse).jobListData;
  if (!Array.isArray(jobs)) {
    throw new Error(`Wayfair job_search_data missing jobListData for ${url}`);
  }

  return jobs;
}

export function isWayfairListCandidate(job: WayfairJobSummary): boolean {
  return INTERNSHIP_LIST_TITLE_PATTERN.test(job.title?.trim() ?? "");
}

export function buildWayfairPostingUrl(board: WayfairBoardConfig, job: WayfairJobSummary): string {
  const id = job.id;
  if (typeof id === "number" && id > 0) {
    return `${board.careersOrigin.replace(/\/$/, "")}/jobs/${id}`;
  }

  const apply = job.applyLink?.trim() || job.structuredDataApplyLink?.trim();
  return apply && isHttpUrl(apply) ? apply : "";
}

export function formatWayfairLocation(job: WayfairJobSummary): string | null {
  const location = job.location;
  if (!location) {
    return null;
  }

  return (
    location.name?.trim() ||
    [location.city, location.state, location.country].filter(Boolean).join(", ").trim() ||
    null
  );
}

export function parseWayfairJobs(
  jobs: WayfairJobSummary[],
  source: CompanySourceConfig,
  fetchedCount: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const job of jobs) {
    const roleName = job.title?.trim() || "";
    const description = job.description ?? job.briefDescription ?? "";
    const plainDescription = htmlToPlainText(description);
    const location = formatWayfairLocation(job);
    const postingUrl = buildWayfairPostingUrl(resolveWayfairBoard(source), job);

    const classification = classifyForSource(source, {
      title: roleName,
      description: plainDescription,
      employmentType: job.jobTypeDisplayName ?? null,
      locations: location ? [location] : [],
      departments: job.category?.name ? [job.category.name] : job.teamName ? [job.teamName] : [],
    });

    if (!classification.include) {
      if (roleName) {
        rejected.push({ title: roleName, reason: classification.reason });
      }
      continue;
    }

    if (!postingUrl || !isHttpUrl(postingUrl)) {
      if (roleName) {
        rejected.push({ title: roleName, reason: "invalid_url" });
      }
      continue;
    }


    roles.push(
      buildScrapedRole({
        postingUrl,
        roleName,
        companyName: source.companyName,
        companySlug: source.companySlug,
        classification,
        description: job.description ?? job.briefDescription ?? "",
        dates: atsPublishWithModified(
        safeToIsoDate(job.createdDate ?? null),
        safeToIsoDate(job.lastUpdatedDate ?? null),
      ),
      }),
    );
  }

  return buildRoleParseResult(fetchedCount, roles, rejected);
}

async function fetchWayfairJobList(board: WayfairBoardConfig): Promise<WayfairJobSummary[]> {
  const res = await fetchJsonWithTimeout(board.jobSearchUrl, { headers: atsJsonHeaders() });
  if (!res.ok) {
    throw new Error(`Wayfair job_search_data returned ${res.status} for ${board.jobSearchUrl}`);
  }
  const payload = (await res.json()) as unknown;
  return parseWayfairJobSearchResponse(payload, board.jobSearchUrl);
}

