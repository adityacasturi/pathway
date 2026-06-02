import { extractAvatureDetailDatePosted } from "../avature-dates.ts";
import { pagePublishDate, parseFlexiblePostedDate, unknownScrapedDates } from "../posted-date.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { buildScopedPostingUrl, parseByteDanceBrandBoard, shouldIncludeJobForBrandScope, type ByteDanceBrandScope } from "./bytedance-brand.ts";
import { fetchLifeAtTikTokJob } from "./lifeattiktok.ts";
import { fetchJsonWithTimeout, isHttpUrl, scraperDelay } from "./shared.ts";

/** ByteDance careers search API (jobs.bytedance.com public supplier). */
export const BYTEDANCE_CAREERS_ORIGIN = "https://jobs.bytedance.com";
export const BYTEDANCE_SEARCH_API_URL = `${BYTEDANCE_CAREERS_ORIGIN}/api/v1/public/supplier/search/job/posts`;
export const BYTEDANCE_DEFAULT_SOURCE_URL = `${BYTEDANCE_CAREERS_ORIGIN}/en/position`;
export const BYTEDANCE_DEFAULT_LOCALE = "en";

export {
  BYTEDANCE_DEFAULT_SEARCH_QUERIES,
  TIKTOK_DEFAULT_SEARCH_QUERIES,
  TIKTOK_CAREERS_ORIGIN,
  TIKTOK_DEFAULT_SOURCE_URL,
} from "./bytedance-brand.ts";

const BYTEDANCE_PAGE_SIZE = 50;
const BYTEDANCE_MAX_PAGES = 30;
const BYTEDANCE_REQUEST_DELAY_MS = 250;
const BYTEDANCE_DETAIL_CONCURRENCY = 6;

const INTERNSHIP_LIST_TITLE_PATTERN =
  /\bintern(?:ship|ships)?\b|\bco-?op\b|\bfellowship\b|\buniversity\b|\bproject\s+intern\b/i;

export interface ByteDanceLocationNode {
  code?: string;
  name?: string;
  en_name?: string;
  i18n_name?: string;
  location_type?: number;
  parent?: ByteDanceLocationNode | null;
}

export interface ByteDanceJob {
  id: string;
  code?: string;
  title?: string;
  description?: string;
  requirement?: string;
  recruit_type?: {
    id?: string;
    name?: string;
    en_name?: string;
    i18n_name?: string;
  };
  job_category?: {
    name?: string;
    en_name?: string;
    i18n_name?: string;
    parent?: { name?: string; en_name?: string } | null;
  };
  city_info?: ByteDanceLocationNode | null;
  job_subject?: {
    name?: string;
    en_name?: string;
    i18n_name?: string;
  };
}

export interface ByteDanceSearchResponse {
  code?: number;
  message?: string;
  data?: {
    job_post_list?: ByteDanceJob[];
    count?: number;
  };
}

export interface ByteDanceBoardConfig {
  locale: string;
  acceptLanguage: string;
  scope: ByteDanceBrandScope;
  searchQueries: string[];
  supplementalJobIds: string[];
}

export function createByteDanceAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveByteDanceBoard(source);
  const boardToken = formatByteDanceBoardToken(board);
  const resolvedSource =
    source.boardToken === boardToken ? source : { ...source, boardToken };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const jobs = await fetchAllByteDanceJobs(board);
      const candidates = jobs
        .filter((job) => isByteDanceListCandidate(job))
        .filter((job) => shouldIncludeJobForBrandScope(board.scope, job));
      const enriched = await enrichByteDanceJobDates(board, candidates);
      return parseByteDanceJobs(enriched, resolvedSource, board, jobs.length);
    },
  };
}

function formatByteDanceBoardToken(board: ByteDanceBoardConfig): string {
  const queries = board.searchQueries.join(",");
  if (board.supplementalJobIds.length === 0) {
    return queries;
  }
  return `${queries}|${board.supplementalJobIds.join(",")}`;
}

export function resolveByteDanceBoard(source: CompanySourceConfig): ByteDanceBoardConfig {
  const locale = parseByteDanceLocale(source.sourceUrl) ?? BYTEDANCE_DEFAULT_LOCALE;
  const brand = parseByteDanceBrandBoard(source);

  return {
    locale,
    acceptLanguage: locale === "en" ? "en-US" : locale,
    scope: brand.scope,
    searchQueries: brand.searchQueries,
    supplementalJobIds: brand.supplementalJobIds,
  };
}

export function parseByteDanceSearchQueries(source: CompanySourceConfig): string[] {
  return resolveByteDanceBoard(source).searchQueries;
}

export function parseByteDanceLocale(sourceUrl: string | null | undefined): string | null {
  if (!sourceUrl?.trim()) {
    return null;
  }

  try {
    const parsed = new URL(sourceUrl);
    const host = parsed.hostname.toLowerCase();
    if (host.includes("lifeattiktok.com")) {
      return BYTEDANCE_DEFAULT_LOCALE;
    }

    if (!host.includes("bytedance.com")) {
      return null;
    }

    const segment = parsed.pathname
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean)[0];
    return segment || BYTEDANCE_DEFAULT_LOCALE;
  } catch {
    return null;
  }
}

export function buildByteDancePostingUrl(board: ByteDanceBoardConfig, jobId: string): string {
  return buildScopedPostingUrl(board.scope, board.locale, jobId);
}

export function formatByteDanceLocations(job: ByteDanceJob): string[] {
  const labels: string[] = [];
  let node: ByteDanceLocationNode | null | undefined = job.city_info;

  while (node) {
    const label = node.en_name?.trim() || node.i18n_name?.trim() || node.name?.trim();
    if (label) {
      labels.push(label);
    }
    node = node.parent ?? null;
  }

  return labels.length > 0 ? [labels.join(", ")] : [];
}

export interface ByteDanceEnrichedJob {
  job: ByteDanceJob;
  datePosted: string | null;
}

export function byteDanceJobDates(job: ByteDanceEnrichedJob) {
  const published = parseFlexiblePostedDate(job.datePosted);
  if (published) {
    return pagePublishDate(published, "medium");
  }
  return unknownScrapedDates();
}

export async function enrichByteDanceJobDates(
  board: ByteDanceBoardConfig,
  jobs: ByteDanceJob[],
): Promise<ByteDanceEnrichedJob[]> {
  const dateById = new Map<string, string | null>();
  let index = 0;

  async function worker(): Promise<void> {
    while (index < jobs.length) {
      const job = jobs[index];
      index += 1;
      if (!job?.id) {
        continue;
      }
      dateById.set(job.id, await fetchByteDanceDetailDatePosted(board, job.id));
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(BYTEDANCE_DETAIL_CONCURRENCY, jobs.length || 1) }, () => worker()),
  );

  return jobs.map((job) => ({
    job,
    datePosted: dateById.get(job.id) ?? null,
  }));
}

export async function fetchByteDanceDetailDatePosted(
  board: ByteDanceBoardConfig,
  jobId: string,
): Promise<string | null> {
  const url = `${BYTEDANCE_CAREERS_ORIGIN}/${board.locale}/position/${jobId}/detail`;
  try {
    const res = await fetchJsonWithTimeout(url, {
      headers: {
        ...bytedanceSearchHeaders(board),
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) {
      return null;
    }
    const html = await res.text();
    return extractAvatureDetailDatePosted(html);
  } catch {
    return null;
  }
}

export function byteDanceJobDescription(job: ByteDanceJob): string {
  const parts = [job.description, job.requirement]
    .map((part) => part?.trim() || "")
    .filter(Boolean);
  return parts.join("\n\n");
}

export function parseByteDanceJobs(
  enriched: ByteDanceEnrichedJob[],
  source: CompanySourceConfig,
  board: ByteDanceBoardConfig,
  fetchedTotal: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const { job, datePosted } of enriched) {
    const roleName = job.title?.trim() || "";
    const description = byteDanceJobDescription(job);
    const locations = formatByteDanceLocations(job);
    const postingUrl = buildByteDancePostingUrl(board, job.id);
    const departments = [
      job.job_category?.en_name,
      job.job_category?.name,
      job.job_subject?.en_name,
      job.job_subject?.name,
    ]
      .map((part) => part?.trim() || "")
      .filter(Boolean);

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      employmentType: job.recruit_type?.en_name?.trim() || job.recruit_type?.name?.trim() || null,
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
        description: byteDanceJobDescription(job),
        dates: byteDanceJobDates({ job, datePosted }),
      }),
    );
  }

  return buildRoleParseResult(fetchedTotal, roles, rejected);
}

export function parseByteDanceSearchResponse(payload: unknown, url: string): ByteDanceSearchResponse {
  if (!payload || typeof payload !== "object") {
    throw new Error(`ByteDance search response was not JSON for ${url}`);
  }

  return payload as ByteDanceSearchResponse;
}

export function isByteDanceListCandidate(job: ByteDanceJob): boolean {
  const recruitType = job.recruit_type?.en_name?.trim() || job.recruit_type?.i18n_name?.trim() || "";
  if (/^intern$/i.test(recruitType)) {
    return true;
  }

  const title = job.title?.trim() ?? "";
  if (/\binternal\b|\binternational\b/i.test(title) && !INTERNSHIP_LIST_TITLE_PATTERN.test(title)) {
    return false;
  }

  return INTERNSHIP_LIST_TITLE_PATTERN.test(title);
}

async function fetchAllByteDanceJobs(board: ByteDanceBoardConfig): Promise<ByteDanceJob[]> {
  const byId = new Map<string, ByteDanceJob>();

  for (const keyword of board.searchQueries) {
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;

    for (let page = 0; page < BYTEDANCE_MAX_PAGES && offset < total; page++) {
      const { jobs, count } = await fetchByteDanceSearchPage(board, keyword, offset);
      total = count;
      if (jobs.length === 0) {
        break;
      }

      for (const job of jobs) {
        if (job.id) {
          byId.set(job.id, job);
        }
      }

      offset += jobs.length;
      if (jobs.length < BYTEDANCE_PAGE_SIZE) {
        break;
      }

      await scraperDelay(BYTEDANCE_REQUEST_DELAY_MS);
    }

    await scraperDelay(BYTEDANCE_REQUEST_DELAY_MS);
  }

  if (board.scope === "tiktok") {
    await mergeSupplementalTikTokJobs(byId, board.supplementalJobIds);
  }

  return Array.from(byId.values());
}

async function mergeSupplementalTikTokJobs(byId: Map<string, ByteDanceJob>, jobIds: string[]): Promise<void> {
  for (const jobId of jobIds) {
    if (byId.has(jobId)) {
      continue;
    }

    const fromApi = await fetchByteDanceJobFromSupplierSearch(jobId);
    if (fromApi) {
      byId.set(jobId, fromApi);
      continue;
    }

    const fromLifeAtTikTok = await fetchLifeAtTikTokJob(jobId);
    if (fromLifeAtTikTok) {
      byId.set(jobId, fromLifeAtTikTok);
    }
  }
}

/** Best-effort lookup when a role is missing from paginated keyword search. */
async function fetchByteDanceJobFromSupplierSearch(jobId: string): Promise<ByteDanceJob | null> {
  const board: ByteDanceBoardConfig = {
    locale: BYTEDANCE_DEFAULT_LOCALE,
    acceptLanguage: "en-US",
    scope: "tiktok",
    searchQueries: ["TikTok intern"],
    supplementalJobIds: [],
  };

  for (let offset = 0; offset < BYTEDANCE_MAX_PAGES * BYTEDANCE_PAGE_SIZE; offset += BYTEDANCE_PAGE_SIZE) {
    const { jobs } = await fetchByteDanceSearchPage(board, "TikTok intern", offset);
    const hit = jobs.find((job) => job.id === jobId);
    if (hit) {
      return hit;
    }
    if (jobs.length < BYTEDANCE_PAGE_SIZE) {
      break;
    }
    await scraperDelay(BYTEDANCE_REQUEST_DELAY_MS);
  }

  return null;
}

async function fetchByteDanceSearchPage(
  board: ByteDanceBoardConfig,
  keyword: string,
  offset: number,
): Promise<{ jobs: ByteDanceJob[]; count: number }> {
  const res = await fetchJsonWithTimeout(BYTEDANCE_SEARCH_API_URL, {
    method: "POST",
    headers: bytedanceSearchHeaders(board),
    body: JSON.stringify({
      recruitment_id_list: [],
      job_category_id_list: [],
      subject_id_list: [],
      location_code_list: [],
      keyword,
      limit: BYTEDANCE_PAGE_SIZE,
      offset,
    }),
  });

  if (!res.ok) {
    throw new Error(`ByteDance search returned ${res.status} for ${BYTEDANCE_SEARCH_API_URL}`);
  }

  const payload = parseByteDanceSearchResponse((await res.json()) as unknown, BYTEDANCE_SEARCH_API_URL);
  if (payload.code !== 0) {
    throw new Error(
      `ByteDance search returned code ${String(payload.code)} for ${BYTEDANCE_SEARCH_API_URL}: ${payload.message ?? "unknown error"}`,
    );
  }

  const jobs = payload.data?.job_post_list ?? [];
  const count = payload.data?.count ?? jobs.length;
  return { jobs, count };
}

export function bytedanceSearchHeaders(board: ByteDanceBoardConfig): HeadersInit {
  const referer = board.scope === "tiktok" ? "https://lifeattiktok.com/" : "https://joinbytedance.com/";
  return {
    "Content-Type": "application/json",
    accept: "application/json",
    "accept-language": board.acceptLanguage,
    "website-path": board.locale,
    Referer: referer,
  };
}

export { resolveByteDanceBrandScope, isByteDanceTikTokScopedJob } from "./bytedance-brand.ts";
