import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { atsPublishDate, unknownScrapedDates } from "../posted-date.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, safeToIsoDate } from "./shared.ts";

export const MODULAR_CAREERS_URL = "https://www.modular.com/company/careers";
export const MODULAR_GEM_BOARD_TOKEN = "modular";
export const MODULAR_GEM_JOB_POSTS_URL = `https://api.gem.com/job_board/v0/${MODULAR_GEM_BOARD_TOKEN}/job_posts/`;

export interface ModularBoardConfig {
  careersUrl: string;
  gemBoardToken: string;
  jobPostsUrl: string;
}

export interface ModularGemJob {
  absolute_url?: string;
  title?: string;
  content_plain?: string;
  employment_type?: string;
  first_published_at?: string;
  location?: { name?: string };
  location_type?: string;
  departments?: Array<{ name?: string }>;
}

export function createModularAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveModularBoard(source);
  const resolvedSource =
    source.sourceUrl === board.careersUrl && source.boardToken === board.gemBoardToken
      ? source
      : { ...source, sourceUrl: board.careersUrl, boardToken: board.gemBoardToken };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const jobs = await fetchModularGemJobs(board);
      return parseModularJobs(jobs, resolvedSource, jobs.length);
    },
  };
}

export function resolveModularBoard(source: CompanySourceConfig): ModularBoardConfig {
  const careersUrl = isModularCareersUrl(source.sourceUrl) ? source.sourceUrl.trim() : MODULAR_CAREERS_URL;
  const gemBoardToken = source.boardToken?.trim() || MODULAR_GEM_BOARD_TOKEN;
  return {
    careersUrl,
    gemBoardToken,
    jobPostsUrl: `https://api.gem.com/job_board/v0/${gemBoardToken}/job_posts/`,
  };
}

export function isModularCareersUrl(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    return (
      parsed.hostname.replace(/^www\./, "") === "modular.com" &&
      parsed.pathname.startsWith("/company/careers")
    );
  } catch {
    return false;
  }
}

export function parseModularJobs(
  jobs: ModularGemJob[],
  source: CompanySourceConfig,
  fetchedTotal: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const job of jobs) {
    const roleName = job.title?.trim() || "";
    const postingUrl = job.absolute_url?.trim() || "";
    const description = job.content_plain?.trim() || "";
    const location = formatModularLocation(job);
    const departments = (job.departments ?? [])
      .map((department) => department.name?.trim())
      .filter(Boolean) as string[];

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

    const publishedAt = safeToIsoDate(job.first_published_at);
    roles.push(
      buildScrapedRole({
        postingUrl,
        roleName,
        companyName: source.companyName,
        companySlug: source.companySlug,
        classification,
        description: job.content_plain?.trim() || "",
        dates: publishedAt ? atsPublishDate(publishedAt) : unknownScrapedDates(),
      }),
    );
  }

  return buildRoleParseResult(fetchedTotal, roles, rejected);
}

export function formatModularLocation(job: ModularGemJob): string | null {
  const parts: string[] = [];
  const name = job.location?.name?.trim();
  if (name) {
    parts.push(name.replace(/_/g, " "));
  }
  const locationType = job.location_type?.trim();
  if (locationType) {
    const formatted = locationType.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
    parts.push(formatted);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

async function fetchModularGemJobs(board: ModularBoardConfig): Promise<ModularGemJob[]> {
  const res = await fetchJsonWithTimeout(board.jobPostsUrl, {
    headers: { accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Modular Gem job board returned ${res.status} for ${board.jobPostsUrl}`);
  }

  const payload = (await res.json()) as unknown;
  if (!Array.isArray(payload)) {
    throw new Error(`Modular Gem job board JSON was not an array`);
  }

  return dedupeModularGemJobs(
    payload.filter(
      (job): job is ModularGemJob =>
        typeof job === "object" &&
        job !== null &&
        typeof (job as ModularGemJob).absolute_url === "string" &&
        (job as ModularGemJob).absolute_url!.includes("jobs.gem.com"),
    ),
  );
}

function dedupeModularGemJobs(jobs: ModularGemJob[]): ModularGemJob[] {
  const byUrl = new Map<string, ModularGemJob>();
  for (const job of jobs) {
    const url = job.absolute_url?.trim();
    if (url) {
      byUrl.set(url, job);
    }
  }
  return Array.from(byUrl.values());
}

