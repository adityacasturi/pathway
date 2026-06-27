import { classifyForSource } from "../adapter-parse.ts";
import { stripHtml } from "../html-utils.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonPayloadWithTimeout, isHttpUrl, resolveBoardToken, scraperDelay } from "./shared.ts";

/** Public ClearCompany career-site API (no auth); board_token is the site id. */
export const CLEARCOMPANY_API_ORIGIN = "https://careers-api.clearcompany.com";

const DESCRIPTION_MAX_LENGTH = 4000;
const CLEARCOMPANY_HEADERS = { "accept-encoding": "identity" };
/** Full-board payloads (~1MB+) are flaky; paginate to keep each response small. */
const CLEARCOMPANY_PAGE_SIZE = 25;
const CLEARCOMPANY_MAX_PAGES = 80;
const CLEARCOMPANY_PAGE_DELAY_MS = 100;

export interface ClearCompanyLocation {
  city?: string | null;
  subdivision?: string | null;
  subdivisionFullName?: string | null;
  country?: string | null;
  isRemote?: boolean | null;
}

export interface ClearCompanyJob {
  id?: string;
  positionTitle?: string;
  description?: string | null;
  departmentName?: string | null;
  location?: string | null;
  locations?: ClearCompanyLocation[];
  applyLink?: string | null;
}

export interface ClearCompanyResponse {
  results?: ClearCompanyJob[];
  totalCount?: number;
}

export function createClearCompanyAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const siteId = resolveClearCompanySiteId(source);
  const resolvedSource = source.boardToken === siteId ? source : { ...source, boardToken: siteId };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const jobs = await fetchAllClearCompanyJobs(siteId);
      return parseClearCompanyJobs(jobs, resolvedSource);
    },
  };
}

export function buildClearCompanyListUrl(
  siteId: string,
  pageIndex: number,
  pageSize = CLEARCOMPANY_PAGE_SIZE,
): string {
  const url = new URL(`${CLEARCOMPANY_API_ORIGIN}/v1/${siteId}`);
  url.searchParams.set("pageIndex", String(pageIndex));
  url.searchParams.set("pageSize", String(pageSize));
  return url.toString();
}

export function mergeClearCompanyJobPages(pages: readonly ClearCompanyJob[][]): ClearCompanyJob[] {
  const merged: ClearCompanyJob[] = [];
  const seen = new Set<string>();

  for (const page of pages) {
    for (const job of page) {
      const key =
        job.id?.trim() ||
        normalizeClearCompanyPostingUrl(job.applyLink ?? "") ||
        job.positionTitle?.trim() ||
        "";
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push(job);
    }
  }

  return merged;
}

async function fetchAllClearCompanyJobs(siteId: string): Promise<ClearCompanyJob[]> {
  const pages: ClearCompanyJob[][] = [];
  let totalCount: number | null = null;

  for (let pageIndex = 0; pageIndex < CLEARCOMPANY_MAX_PAGES; pageIndex += 1) {
    const url = buildClearCompanyListUrl(siteId, pageIndex);
    const { response: res, data: payload } = await fetchJsonPayloadWithTimeout<ClearCompanyResponse>(url, {
      headers: CLEARCOMPANY_HEADERS,
    });
    if (!res.ok) {
      throw new Error(`ClearCompany returned ${res.status} for ${url}`);
    }

    const batch = Array.isArray(payload.results) ? payload.results : [];
    if (totalCount === null && typeof payload.totalCount === "number") {
      totalCount = payload.totalCount;
    }
    pages.push(batch);

    if (batch.length < CLEARCOMPANY_PAGE_SIZE) {
      break;
    }
    if (totalCount !== null && mergeClearCompanyJobPages(pages).length >= totalCount) {
      break;
    }

    await scraperDelay(CLEARCOMPANY_PAGE_DELAY_MS);
  }

  return mergeClearCompanyJobPages(pages);
}

export function resolveClearCompanySiteId(source: CompanySourceConfig): string {
  return resolveBoardToken(source, (sourceUrl) => {
    try {
      const parsed = new URL(sourceUrl);
      return parsed.searchParams.get("siteId");
    } catch {
      return null;
    }
  });
}

export function formatClearCompanyLocation(location: ClearCompanyLocation): string | null {
  const parts = [location.city?.trim(), location.subdivision?.trim(), location.country?.trim()]
    .filter((part): part is string => Boolean(part));
  if (parts.length === 0) {
    return location.isRemote ? "Remote" : null;
  }
  return parts.join(", ");
}

export function normalizeClearCompanyPostingUrl(applyLink: string): string {
  const trimmed = applyLink.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed);
    parsed.search = "";
    parsed.hash = "";
    parsed.pathname = parsed.pathname.replace(/\/apply\/?$/, "");
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

export function parseClearCompanyJobs(
  jobs: ClearCompanyJob[],
  source: CompanySourceConfig,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const job of jobs) {
    const roleName = job.positionTitle?.trim() || "";
    const postingUrl = normalizeClearCompanyPostingUrl(job.applyLink ?? "");
    const description = job.description ? stripHtml(job.description).slice(0, DESCRIPTION_MAX_LENGTH) : "";

    const structuredLocations = (job.locations ?? [])
      .map((location) => formatClearCompanyLocation(location))
      .filter((label): label is string => Boolean(label));
    const locations =
      structuredLocations.length > 0
        ? structuredLocations
        : job.location?.trim()
          ? [job.location.trim()]
          : [];

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      departments: job.departmentName ? [job.departmentName] : [],
      locations,
    });

    if (!classification.include) {
      if (roleName) {
        rejected.push({ title: roleName, reason: classification.reason });
      }
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
      }),
    );
  }

  return buildRoleParseResult(jobs.length, roles, rejected);
}
