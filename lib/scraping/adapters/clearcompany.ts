import { classifyForSource } from "../adapter-parse.ts";
import { stripHtml } from "../html-utils.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, resolveBoardToken } from "./shared.ts";

/** Public ClearCompany career-site API (no auth); board_token is the site id. */
export const CLEARCOMPANY_API_ORIGIN = "https://careers-api.clearcompany.com";

const DESCRIPTION_MAX_LENGTH = 4000;
const CLEARCOMPANY_HEADERS = { "accept-encoding": "identity" };

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
      const url = `${CLEARCOMPANY_API_ORIGIN}/v1/${siteId}`;
      const res = await fetchJsonWithTimeout(url, { headers: CLEARCOMPANY_HEADERS });
      if (!res.ok) {
        throw new Error(`ClearCompany returned ${res.status} for ${url}`);
      }

      const payload = (await res.json()) as ClearCompanyResponse;
      const jobs = Array.isArray(payload.results) ? payload.results : [];
      return parseClearCompanyJobs(jobs, resolvedSource);
    },
  };
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
