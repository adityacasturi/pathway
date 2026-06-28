import { classifyForSource } from "../adapter-parse.ts";
import {
  flattenGreenhouseMetadataValues,
  type GreenhouseBoardJob,
  parseGreenhouseEmploymentMetadata,
} from "../greenhouse-board.ts";
import { isInvalidScrapedLocationToken } from "../location.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import {
  fetchJsonWithTimeout,
  isHttpUrl,
  parseLeadingPathToken,
  resolveBoardToken,
} from "./shared.ts";

export type GreenhouseJob = GreenhouseBoardJob;

export { parseGreenhouseEmploymentMetadata } from "../greenhouse-board.ts";

export function createGreenhouseAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const boardToken = resolveBoardToken(source, (sourceUrl) =>
    parseLeadingPathToken(sourceUrl, ["boards.greenhouse.io", "job-boards.greenhouse.io"]),
  );
  const resolvedSource = source.boardToken === boardToken ? source : { ...source, boardToken };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;
      const res = await fetchJsonWithTimeout(url);
      if (!res.ok) {
        throw new Error(`Greenhouse returned ${res.status} for ${url}`);
      }
      const payload = (await res.json()) as unknown;
      const jobs = parseGreenhouseResponse(payload, url);
      return parseGreenhouseJobs(jobs, resolvedSource);
    },
  };
}

export function parseGreenhouseJobs(jobs: GreenhouseJob[], source: CompanySourceConfig): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const job of jobs) {
    const roleName = job.title?.trim() || "";
    const postingUrl = job.absolute_url?.trim() || "";
    const content = job.content || "";
    const locationSegments = collectGreenhouseLocationSegments(job, source);
    const departments = (job.departments ?? [])
      .map((department) => department.name?.trim() || "")
      .filter(Boolean);

    const employment = parseGreenhouseEmploymentMetadata(job.metadata);

    const classification = classifyForSource(source, {
      title: roleName,
      description: content,
      employmentType: employment.employmentType,
      commitment: employment.commitment,
      departments,
      locations: locationSegments,
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
        seasonHints: {
          employmentType: employment.employmentType,
          commitment: employment.commitment,
          departments,
        },
        atsDates: {
          publishedAt: job.first_published ?? null,
          updatedAt: job.updated_at ?? null,
        },
      }),
    );
  }

  return buildRoleParseResult(jobs.length, roles, rejected);
}

/** All location segments from board + metadata (classification trims to US). */
export function collectGreenhouseLocationSegments(
  job: GreenhouseJob,
  source: CompanySourceConfig,
): string[] {
  const segments: string[] = [];
  const context = { companyName: source.companyName };

  const pushSegment = (segment: string) => {
    const trimmed = segment.trim();
    if (!trimmed || /^location$/i.test(trimmed) || isInvalidScrapedLocationToken(trimmed, context)) {
      return;
    }
    segments.push(trimmed);
  };

  const fromBoard = job.location?.name?.trim() || "";
  pushSegment(fromBoard);

  for (const office of job.offices ?? []) {
    pushSegment(office.location?.trim() || office.name?.trim() || "");
  }

  for (const item of job.metadata ?? []) {
    const label = item.name?.trim().toLowerCase() ?? "";
    if (
      !label.includes("location") &&
      label !== "office" &&
      !label.includes("work location") &&
      !label.includes("primary location") &&
      !label.includes("job location")
    ) {
      continue;
    }

    for (const value of flattenGreenhouseMetadataValues(item.value)) {
      pushSegment(value);
    }
  }

  return segments;
}

function parseGreenhouseResponse(payload: unknown, url: string): GreenhouseJob[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { jobs?: unknown }).jobs)) {
    throw new Error(`Greenhouse response was not in expected format for ${url}`);
  }
  return (payload as { jobs: GreenhouseJob[] }).jobs;
}
