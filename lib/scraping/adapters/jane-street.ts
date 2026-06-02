import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { inferSeason } from "../season.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter, ScrapedSeason } from "../types.ts";
import { greenhouseRoleDates } from "../posted-date.ts";
import {
  fetchJsonWithTimeout,
  isHttpUrl,
  resolveBoardToken,
} from "./shared.ts";

/** Public Greenhouse boards API; job-boards.greenhouse.io is HTML-only. */
export const JANE_STREET_GREENHOUSE_BOARD = "janestreet";

export const JANE_STREET_CAREERS_URL = "https://www.janestreet.com/join-jane-street/open-roles";

export interface JaneStreetGreenhouseJob {
  id: string | number;
  title?: string;
  absolute_url?: string;
  content?: string;
  location?: {
    name?: string;
  };
  metadata?: Array<{
    name?: string;
    value?: string | null;
  }>;
  updated_at?: string;
  first_published?: string;
}

export interface JaneStreetEmploymentMetadata {
  employmentType: string | null;
  duration: string | null;
}

export function createJaneStreetAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const boardToken = resolveBoardToken(source, () => JANE_STREET_GREENHOUSE_BOARD);
  const resolvedSource = source.boardToken === boardToken ? source : { ...source, boardToken };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;
      const res = await fetchJsonWithTimeout(url);
      if (!res.ok) {
        throw new Error(`Jane Street Greenhouse API returned ${res.status} for ${url}`);
      }
      const payload = (await res.json()) as unknown;
      const jobs = parseJaneStreetResponse(payload, url);
      return parseJaneStreetJobs(jobs, resolvedSource);
    },
  };
}

export function parseJaneStreetEmploymentMetadata(
  metadata: JaneStreetGreenhouseJob["metadata"],
): JaneStreetEmploymentMetadata {
  let employmentType: string | null = null;
  let duration: string | null = null;

  for (const item of metadata ?? []) {
    const label = item.name?.trim().toLowerCase() ?? "";
    const value = typeof item.value === "string" ? item.value.trim() : "";
    if (!value) {
      continue;
    }

    if (label === "employment type") {
      employmentType = value;
    }
    if (label === "duration") {
      duration = value;
    }
  }

  return { employmentType, duration };
}

export function inferJaneStreetSeason(
  title: string,
  employment: JaneStreetEmploymentMetadata,
  description = "",
): ScrapedSeason {
  const seasonText = [title, employment.employmentType, employment.duration, description]
    .filter(Boolean)
    .join(" ");
  return inferSeason(seasonText);
}

export function parseJaneStreetJobs(
  jobs: JaneStreetGreenhouseJob[],
  source: CompanySourceConfig,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const job of jobs) {
    const roleName = job.title?.trim() || "";
    const postingUrl = job.absolute_url?.trim() || "";
    const content = job.content || "";
    const location = job.location?.name?.trim() || null;
    const employment = parseJaneStreetEmploymentMetadata(job.metadata);

    const classification = classifyForSource(source, {
      title: roleName,
      description: content,
      employmentType: employment.employmentType,
      commitment: employment.duration,
      locations: location ? [location] : [],
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
        description: content,
        dates: greenhouseRoleDates(job),
        season: inferJaneStreetSeason(roleName, employment, content),
        seasonHints: {
          employmentType: employment.employmentType,
          commitment: employment.duration,
        },
      }),
    );
  }

  return buildRoleParseResult(jobs.length, roles, rejected);
}

function parseJaneStreetResponse(payload: unknown, url: string): JaneStreetGreenhouseJob[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { jobs?: unknown }).jobs)) {
    throw new Error(`Jane Street Greenhouse response was not in expected format for ${url}`);
  }
  return (payload as { jobs: JaneStreetGreenhouseJob[] }).jobs;
}

