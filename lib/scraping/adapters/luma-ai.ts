import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { atsPublishDate, unknownScrapedDates } from "../posted-date.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, safeToIsoDate } from "./shared.ts";

export const LUMA_AI_CAREERS_URL = "https://lumalabs.ai/careers";
export const LUMA_AI_GEM_BOARD_TOKEN = "lumalabs-ai";

export interface LumaAiBoardConfig {
  careersUrl: string;
  gemBoardToken: string;
}

export interface LumaGemJob {
  absolute_url?: string;
  title?: string;
  content_plain?: string;
  employment_type?: string;
  first_published_at?: string;
  location?: { name?: string };
  location_type?: string;
  departments?: Array<{ name?: string }>;
}

export function createLumaAiAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveLumaAiBoard(source);
  const resolvedSource =
    source.sourceUrl === board.careersUrl && source.boardToken === board.gemBoardToken
      ? source
      : { ...source, sourceUrl: board.careersUrl, boardToken: board.gemBoardToken };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const html = await fetchLumaAiCareersHtml(board.careersUrl);
      const jobs = extractLumaGemJobsFromCareersHtml(html);
      return parseLumaAiJobs(jobs, resolvedSource, jobs.length);
    },
  };
}

export function resolveLumaAiBoard(source: CompanySourceConfig): LumaAiBoardConfig {
  const careersUrl = isLumaAiCareersUrl(source.sourceUrl) ? source.sourceUrl.trim() : LUMA_AI_CAREERS_URL;
  const gemBoardToken = source.boardToken?.trim() || LUMA_AI_GEM_BOARD_TOKEN;
  return { careersUrl, gemBoardToken };
}

export function isLumaAiCareersUrl(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    return parsed.hostname.replace(/^www\./, "") === "lumalabs.ai" && parsed.pathname.startsWith("/careers");
  } catch {
    return false;
  }
}

export function extractLumaGemJobsFromCareersHtml(html: string): LumaGemJob[] {
  const markerIndex = html.indexOf("jobsData");
  if (markerIndex < 0) {
    return [];
  }

  const regionEnd = Math.min(html.length, markerIndex + 120_000);
  const region = unescapeEmbeddedJson(html.slice(markerIndex, regionEnd));
  const arrayStart = region.indexOf("[");
  if (arrayStart < 0) {
    return [];
  }

  const arrayEnd = findMatchingBracketEnd(region, arrayStart, "[", "]");
  if (arrayEnd < 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(region.slice(arrayStart, arrayEnd + 1)) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return dedupeLumaGemJobs(
      parsed.filter(
        (job): job is LumaGemJob =>
          typeof job === "object" &&
          job !== null &&
          typeof (job as LumaGemJob).absolute_url === "string" &&
          (job as LumaGemJob).absolute_url!.includes("jobs.gem.com"),
      ),
    );
  } catch {
    return [];
  }
}

export function parseLumaAiJobs(
  jobs: LumaGemJob[],
  source: CompanySourceConfig,
  fetchedTotal: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const job of jobs) {
    const roleName = job.title?.trim() || "";
    const postingUrl = job.absolute_url?.trim() || "";
    const description = job.content_plain?.trim() || "";
    const location = job.location?.name?.trim() || null;
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

function findMatchingBracketEnd(
  text: string,
  startIndex: number,
  openChar: string,
  closeChar: string,
): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];

    if (!inString && char === "\\" && text[index + 1] === '"') {
      inString = true;
      index += 1;
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === openChar) {
      depth += 1;
      continue;
    }

    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function unescapeEmbeddedJson(raw: string): string {
  return raw.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

async function fetchLumaAiCareersHtml(url: string): Promise<string> {
  const res = await fetchJsonWithTimeout(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!res.ok) {
    throw new Error(`Luma AI careers returned ${res.status} for ${url}`);
  }

  return res.text();
}

function dedupeLumaGemJobs(jobs: LumaGemJob[]): LumaGemJob[] {
  const byUrl = new Map<string, LumaGemJob>();
  for (const job of jobs) {
    const url = job.absolute_url?.trim();
    if (url) {
      byUrl.set(url, job);
    }
  }
  return Array.from(byUrl.values());
}

