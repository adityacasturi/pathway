import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl } from "./shared.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";

/** Uber careers search API on uber.com (custom ATS, not Greenhouse/Lever). */
export const UBER_CAREERS_ORIGIN = "https://www.uber.com";
export const UBER_SEARCH_API_URL = `${UBER_CAREERS_ORIGIN}/api/loadSearchJobsResults`;
export const UBER_DEFAULT_CAREERS_URL =
  "https://www.uber.com/careers/list/?team=Engineering&programAndLevel=Internship";

export interface UberLocation {
  country?: string;
  region?: string | null;
  city?: string;
  countryName?: string;
}

export interface UberJob {
  id: number;
  title?: string;
  description?: string;
  department?: string;
  type?: string;
  programAndPlatform?: string;
  location?: UberLocation;
  level?: string;
  team?: string;
  timeType?: string;
  allLocations?: UberLocation[];
}

export interface UberSearchFilters {
  department: string[];
  location: string[];
  programAndLevel: string[];
  team: string[];
}

export interface UberSearchResponse {
  status?: string;
  data?: {
    results?: UberJob[];
    totalResults?: number | { low?: number; high?: number };
  };
}

export function createUberAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const resolvedSource = resolveUberSource(source);
  const filters = parseUberSearchFilters(resolvedSource.sourceUrl);

  return {
    source: resolvedSource,
    async fetchRoles() {
      const jobs = await fetchAllUberJobs(filters);
      const candidates = jobs.filter((job) => isUberListCandidate(job));
      return parseUberJobs(candidates, resolvedSource, jobs.length);
    },
  };
}

export function resolveUberSource(source: CompanySourceConfig): CompanySourceConfig {
  const sourceUrl = source.sourceUrl.trim() || UBER_DEFAULT_CAREERS_URL;
  return source.sourceUrl === sourceUrl ? source : { ...source, sourceUrl };
}

export function parseUberSearchFilters(sourceUrl: string): UberSearchFilters {
  const defaults: UberSearchFilters = {
    department: [],
    location: [],
    programAndLevel: ["Internship"],
    team: ["Engineering"],
  };

  try {
    const parsed = new URL(sourceUrl);
    const department = parsed.searchParams.getAll("department").map((value) => value.trim()).filter(Boolean);
    const team = parsed.searchParams.getAll("team").map((value) => value.trim()).filter(Boolean);
    const programAndLevel = parsed.searchParams
      .getAll("programAndLevel")
      .map((value) => value.trim())
      .filter(Boolean);
    const location = parsed.searchParams.getAll("location").map((value) => value.trim()).filter(Boolean);

    return {
      department: department.length > 0 ? department : defaults.department,
      location: location.length > 0 ? location : defaults.location,
      programAndLevel: programAndLevel.length > 0 ? programAndLevel : defaults.programAndLevel,
      team: team.length > 0 ? team : defaults.team,
    };
  } catch {
    return defaults;
  }
}

export function buildUberPostingUrl(jobId: number | string): string {
  return `${UBER_CAREERS_ORIGIN}/careers/list/${jobId}/`;
}

export function formatUberLocations(job: UberJob): string[] {
  const labels = (job.allLocations?.length ? job.allLocations : job.location ? [job.location] : [])
    .map((location) => formatUberLocation(location))
    .filter(Boolean);

  return Array.from(new Set(labels));
}

export function formatUberLocation(location: UberLocation): string {
  const city = location.city?.trim();
  const region = location.region?.trim();
  const country = location.countryName?.trim() || location.country?.trim();
  return [city, region, country].filter(Boolean).join(", ");
}

export function parseUberJobs(
  jobs: UberJob[],
  source: CompanySourceConfig,
  fetchedTotal: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const job of jobs) {
    const roleName = job.title?.trim() || "";
    const description = job.description?.trim() || "";
    const locations = formatUberLocations(job);
    const postingUrl = buildUberPostingUrl(job.id);
    const departments = [job.department, job.team].map((part) => part?.trim() || "").filter(Boolean);

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      employmentType: job.timeType?.trim() || null,
      team: job.team?.trim() || null,
      departments,
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
        description: job.description?.trim() || "",
      }),
    );
  }

  return buildRoleParseResult(fetchedTotal, roles, rejected);
}

export function parseUberSearchResponse(payload: unknown, url: string): UberJob[] {
  if (!payload || typeof payload !== "object") {
    throw new Error(`Uber search response was not JSON for ${url}`);
  }

  const response = payload as UberSearchResponse;
  if (response.status && response.status !== "success") {
    throw new Error(`Uber search returned status ${response.status} for ${url}`);
  }

  if (!Array.isArray(response.data?.results)) {
    throw new Error(`Uber search response was not in expected format for ${url}`);
  }

  return response.data.results;
}

export function isUberListCandidate(job: UberJob): boolean {
  if (job.timeType?.trim() === "Intern") {
    return true;
  }

  if (job.level === "0.1" || job.level === "0.3") {
    return true;
  }

  const title = job.title?.trim() ?? "";
  if (/\binternal\b|\binternational\b/i.test(title) && !INTERNSHIP_LIST_TITLE_PATTERN.test(title)) {
    return false;
  }

  return INTERNSHIP_LIST_TITLE_PATTERN.test(title);
}

async function fetchAllUberJobs(filters: UberSearchFilters): Promise<UberJob[]> {
  const res = await fetchJsonWithTimeout(UBER_SEARCH_API_URL, {
    method: "POST",
    headers: await uberSearchHeaders(),
    body: JSON.stringify(filters),
  });

  if (!res.ok) {
    throw new Error(`Uber search returned ${res.status} for ${UBER_SEARCH_API_URL}`);
  }

  const payload = (await res.json()) as unknown;
  return parseUberSearchResponse(payload, UBER_SEARCH_API_URL);
}

let cachedUberCsrfToken: string | null = null;

async function uberSearchHeaders(): Promise<HeadersInit> {
  const token = await resolveUberCsrfToken();
  return {
    "Content-Type": "application/json",
    accept: "application/json",
    "x-csrf-token": token,
    "x-requested-with": "XMLHttpRequest",
    Referer: UBER_DEFAULT_CAREERS_URL,
  };
}

async function resolveUberCsrfToken(): Promise<string> {
  if (cachedUberCsrfToken) {
    return cachedUberCsrfToken;
  }

  try {
    const res = await fetchJsonWithTimeout(UBER_DEFAULT_CAREERS_URL, {
      headers: { accept: "text/html,application/xhtml+xml" },
    });
    if (res.ok) {
      const html = await res.text();
      const match =
        html.match(/"csrfToken":"([^"]+)"/) ??
        html.match(/csrfToken\\":\\"([^\\"]+)\\"/) ??
        html.match(/name="csrf-token"\s+content="([^"]+)"/i);
      if (match?.[1]) {
        cachedUberCsrfToken = match[1];
        return cachedUberCsrfToken;
      }
    }
  } catch {
    // fall through
  }

  cachedUberCsrfToken = "x";
  return cachedUberCsrfToken;
}
