import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl } from "./shared.ts";

/** iCIMS Attract career sites expose a public JSON API at {origin}/api/jobs. */
const ICIMS_PAGE_SIZE = 100;
const ICIMS_MAX_PAGES = 20;

const DESCRIPTION_MAX_LENGTH = 4000;

export interface IcimsJob {
  slug?: string;
  title?: string;
  language?: string;
  description?: string | null;
  employment_type?: string | null;
  category?: string[] | string | null;
  full_location?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  location_type?: string | null;
}

export interface IcimsJobsResponse {
  jobs?: Array<{ data?: IcimsJob }>;
  totalCount?: number;
  count?: number;
}

export function createIcimsAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const { apiBase, boardBase } = resolveIcimsUrls(source);

  return {
    source,
    async fetchRoles() {
      const jobs: IcimsJob[] = [];
      let totalCount = Number.POSITIVE_INFINITY;

      for (let page = 1; page <= ICIMS_MAX_PAGES && jobs.length < totalCount; page++) {
        const url = `${apiBase}/api/jobs?page=${page}&limit=${ICIMS_PAGE_SIZE}`;
        const res = await fetchJsonWithTimeout(url);
        if (!res.ok) {
          throw new Error(`iCIMS returned ${res.status} for ${url}`);
        }

        const payload = (await res.json()) as IcimsJobsResponse;
        const pageJobs = (payload.jobs ?? [])
          .map((entry) => entry.data)
          .filter((job): job is IcimsJob => Boolean(job));
        if (typeof payload.totalCount === "number") {
          totalCount = payload.totalCount;
        }
        if (pageJobs.length === 0) {
          break;
        }
        jobs.push(...pageJobs);
      }

      return parseIcimsJobs(jobs, source, boardBase);
    },
  };
}

/** API lives at the site origin; postings live under the careers portal path. */
export function resolveIcimsUrls(source: CompanySourceConfig): { apiBase: string; boardBase: string } {
  let parsed: URL;
  try {
    parsed = new URL(source.sourceUrl);
  } catch {
    throw new Error(`iCIMS source_url is not a valid URL for adapter ${source.adapterKey}`);
  }

  const portalPath = parsed.pathname.replace(/\/+$/, "");
  return {
    apiBase: parsed.origin,
    boardBase: `${parsed.origin}${portalPath}`,
  };
}

export function buildIcimsPostingUrl(boardBase: string, job: IcimsJob): string {
  const slug = job.slug?.trim();
  if (!slug) {
    return "";
  }
  const language = job.language?.trim();
  const langSuffix = language ? `?lang=${encodeURIComponent(language)}` : "";
  return `${boardBase}/jobs/${encodeURIComponent(slug)}${langSuffix}`;
}

export function formatIcimsLocation(job: IcimsJob): string | null {
  const full = job.full_location?.trim();
  if (full) {
    return full;
  }

  const parts = [job.city?.trim(), job.state?.trim(), job.country?.trim()]
    .filter((part): part is string => Boolean(part));
  if (parts.length > 0) {
    return parts.join(", ");
  }

  return job.location_type?.trim().toLowerCase() === "remote" ? "Remote" : null;
}

export function parseIcimsJobs(
  jobs: IcimsJob[],
  source: CompanySourceConfig,
  boardBase: string,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const job of jobs) {
    const roleName = job.title?.trim() || "";
    const postingUrl = buildIcimsPostingUrl(boardBase, job);
    const description = job.description?.trim().slice(0, DESCRIPTION_MAX_LENGTH) ?? "";
    const location = formatIcimsLocation(job);
    const categories = Array.isArray(job.category)
      ? job.category
      : job.category
        ? [job.category]
        : [];
    const departments = categories
      .map((category) => category.trim())
      .filter(Boolean);

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      employmentType: job.employment_type ?? null,
      departments,
      locations: location ? [location] : [],
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
