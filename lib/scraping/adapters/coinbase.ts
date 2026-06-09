import { classifyForSource } from "../adapter-parse.ts";
import { htmlToPlainText } from "../plain-text.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { atsJsonHeaders, fetchJsonWithTimeout, isHttpUrl, resolveBoardToken, scraperDelay } from "./shared.ts";
import { parseGreenhouseEmploymentMetadata } from "./greenhouse.ts";

/**
 * Coinbase careers use a public Coinbase API plus Greenhouse embed metadata
 * (see coinbase.com careers frontend: api.coinbase.com/v2/careers and
 * api.greenhouse.io/v1/boards/{board}/embed/jobs).
 */
export const COINBASE_API_ORIGIN = "https://api.coinbase.com";
export const COINBASE_CAREERS_URL = `${COINBASE_API_ORIGIN}/v2/careers`;
export const COINBASE_POSITIONS_ORIGIN = "https://www.coinbase.com";
export const COINBASE_DEFAULT_POSITIONS_URL = `${COINBASE_POSITIONS_ORIGIN}/careers/positions`;
export const COINBASE_DEFAULT_BOARD_TOKEN = "coinbase";

const COINBASE_DETAIL_CONCURRENCY = 6;
const COINBASE_REQUEST_DELAY_MS = 200;

/** List titles must look internship-related before we fetch full descriptions. */
const INTERNSHIP_LIST_TITLE_PATTERN =
  /\bintern(?:ship|ships)?\b|\bco-?op\b|\bfellowship\b|\buniversity\b|\bemerging\s+talent\b/i;

export interface CoinbaseBoardConfig {
  boardToken: string;
  careersListUrl: string;
  careersOrigin: string;
}

export interface CoinbaseJob {
  id: number;
  title?: string;
  content?: string;
  location?: { name?: string };
  updated_at?: string;
  metadata?: Array<{ name?: string; value?: string | null }>;
  absolute_url?: string;
}

export interface CoinbaseDepartment {
  id: number;
  name: string;
  jobs: CoinbaseJob[];
}

export interface CoinbaseCareersResponse {
  data?: {
    departments?: CoinbaseDepartment[];
  };
}

export interface CoinbaseJobDetailResponse {
  data?: CoinbaseJob;
}

export interface CoinbaseGreenhouseEmbedJob {
  id: number;
  title?: string;
  content?: string;
  location?: { name?: string };
  updated_at?: string;
  metadata?: CoinbaseJob["metadata"];
  absolute_url?: string;
}

interface CoinbaseEnrichedJob {
  job: CoinbaseJob;
  departmentName: string;
  detailContent: string | null;
}

export function createCoinbaseAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveCoinbaseBoard(source);
  const resolvedSource =
    source.boardToken === board.boardToken &&
    source.sourceUrl === board.careersOrigin
      ? source
      : { ...source, boardToken: board.boardToken, sourceUrl: board.careersOrigin };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const departments = await fetchCoinbaseDepartments(board);
      const metadataById = await fetchCoinbaseGreenhouseMetadata(board.boardToken);
      const merged = mergeCoinbaseDepartmentsWithMetadata(departments, metadataById);
      const jobs = flattenCoinbaseJobs(merged);
      const enriched = await enrichCoinbaseJobs(board, jobs);
      return parseCoinbaseJobs(enriched, resolvedSource, jobs.length);
    },
  };
}

export function resolveCoinbaseBoard(source: CompanySourceConfig): CoinbaseBoardConfig {
  const boardToken =
    resolveBoardToken(source, () => COINBASE_DEFAULT_BOARD_TOKEN) || COINBASE_DEFAULT_BOARD_TOKEN;
  const careersOrigin = normalizeCoinbaseCareersUrl(source.sourceUrl);

  return {
    boardToken,
    careersListUrl: COINBASE_CAREERS_URL,
    careersOrigin,
  };
}

export function normalizeCoinbaseCareersUrl(sourceUrl: string): string {
  const trimmed = sourceUrl.trim();
  if (!trimmed) {
    return COINBASE_DEFAULT_POSITIONS_URL;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.replace(/^www\./, "") === "coinbase.com") {
      return trimmed;
    }
  } catch {
    // fall through
  }

  return COINBASE_DEFAULT_POSITIONS_URL;
}

export function buildCoinbaseCareersUrl(board: CoinbaseBoardConfig): string {
  return board.careersListUrl;
}

export function buildCoinbasePostingUrl(jobId: number | string): string {
  return `${COINBASE_POSITIONS_ORIGIN}/careers/positions/${jobId}`;
}

export function buildCoinbaseGreenhouseEmbedJobsUrl(boardToken: string): string {
  return `https://api.greenhouse.io/v1/boards/${boardToken}/embed/jobs`;
}

export function buildCoinbaseGreenhouseEmbedJobUrl(boardToken: string, jobId: number | string): string {
  return `https://api.greenhouse.io/v1/boards/${boardToken}/embed/job?id=${jobId}`;
}

export function buildCoinbaseJobDetailUrl(jobId: number | string): string {
  return `${COINBASE_API_ORIGIN}/v2/careers/${jobId}`;
}

export function parseCoinbaseCareersResponse(payload: unknown, url: string): CoinbaseDepartment[] {
  if (!payload || typeof payload !== "object") {
    throw new Error(`Coinbase careers response was not an object for ${url}`);
  }

  const departments = (payload as CoinbaseCareersResponse).data?.departments;
  if (!Array.isArray(departments)) {
    throw new Error(`Coinbase careers response missing departments for ${url}`);
  }

  return departments;
}

export function mergeCoinbaseDepartmentsWithMetadata(
  departments: CoinbaseDepartment[],
  metadataById: Map<number, CoinbaseJob["metadata"]>,
): CoinbaseDepartment[] {
  return departments
    .map((department) => ({
      ...department,
      jobs: department.jobs.map((job) => ({
        ...job,
        metadata: metadataById.get(job.id) ?? job.metadata,
      })),
    }))
    .filter((department) => department.jobs.length > 0);
}

export function flattenCoinbaseJobs(departments: CoinbaseDepartment[]): Array<{
  job: CoinbaseJob;
  departmentName: string;
}> {
  const rows: Array<{ job: CoinbaseJob; departmentName: string }> = [];

  for (const department of departments) {
    for (const job of department.jobs) {
      rows.push({ job, departmentName: department.name });
    }
  }

  return rows;
}

export function shouldPrefetchCoinbaseDetail(job: CoinbaseJob): boolean {
  const title = job.title?.trim() ?? "";
  if (!title || job.content?.trim()) {
    return false;
  }
  return INTERNSHIP_LIST_TITLE_PATTERN.test(title);
}

export function parseCoinbaseJobs(
  enriched: CoinbaseEnrichedJob[],
  source: CompanySourceConfig,
  fetchedCount: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const { job, departmentName, detailContent } of enriched) {
    const roleName = job.title?.trim() || "";
    const postingUrl = job.absolute_url?.trim() || buildCoinbasePostingUrl(job.id);
    const description = detailContent || job.content || "";
    const descriptionPlain = htmlToPlainText(description);
    const locations = job.location?.name?.trim() ? [job.location.name.trim()] : [];
    const employment = parseGreenhouseEmploymentMetadata(job.metadata);

    const classification = classifyForSource(source, {
      title: roleName,
      description: descriptionPlain,
      employmentType: employment.employmentType,
      commitment: employment.commitment,
      departments: departmentName ? [departmentName] : [],
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
        description: descriptionPlain,
        seasonHints: {
          employmentType: employment.employmentType,
          commitment: employment.commitment,
          departments: departmentName ? [departmentName] : [],
        },
      }),
    );
  }

  return buildRoleParseResult(fetchedCount, roles, rejected);
}

async function fetchCoinbaseDepartments(board: CoinbaseBoardConfig): Promise<CoinbaseDepartment[]> {
  const url = buildCoinbaseCareersUrl(board);
  const res = await fetchJsonWithTimeout(url, { headers: atsJsonHeaders() });
  if (!res.ok) {
    throw new Error(`Coinbase careers API returned ${res.status} for ${url}`);
  }

  const payload = (await res.json()) as unknown;
  return parseCoinbaseCareersResponse(payload, url);
}

async function fetchCoinbaseGreenhouseMetadata(
  boardToken: string,
): Promise<Map<number, CoinbaseJob["metadata"]>> {
  const url = buildCoinbaseGreenhouseEmbedJobsUrl(boardToken);
  const map = new Map<number, CoinbaseJob["metadata"]>();

  try {
    const res = await fetchJsonWithTimeout(url, { headers: atsJsonHeaders() });
    if (!res.ok) {
      return map;
    }

    const payload = (await res.json()) as { jobs?: CoinbaseGreenhouseEmbedJob[] };
    for (const job of payload.jobs ?? []) {
      if (job.metadata) {
        map.set(job.id, job.metadata);
      }
    }
  } catch {
    return map;
  }

  return map;
}

async function enrichCoinbaseJobs(
  board: CoinbaseBoardConfig,
  jobs: Array<{ job: CoinbaseJob; departmentName: string }>,
): Promise<CoinbaseEnrichedJob[]> {
  const needsDetail = jobs.filter(({ job }) => shouldPrefetchCoinbaseDetail(job));
  const detailById = new Map<number, string | null>();

  let index = 0;
  async function worker(): Promise<void> {
    while (index < needsDetail.length) {
      const current = needsDetail[index];
      index += 1;
      if (!current) {
        continue;
      }

      const content = await fetchCoinbaseJobDescription(board, current.job.id);
      detailById.set(current.job.id, content);
      await scraperDelay(COINBASE_REQUEST_DELAY_MS);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(COINBASE_DETAIL_CONCURRENCY, needsDetail.length || 1) }, () =>
      worker(),
    ),
  );

  return jobs.map(({ job, departmentName }) => ({
    job,
    departmentName,
    detailContent: detailById.get(job.id) ?? null,
  }));
}

async function fetchCoinbaseJobDescription(
  board: CoinbaseBoardConfig,
  jobId: number,
): Promise<string | null> {
  const [coinbaseDetail, greenhouseDetail] = await Promise.all([
    fetchCoinbaseJobDetail(jobId),
    fetchCoinbaseGreenhouseEmbedJob(board.boardToken, jobId),
  ]);

  return greenhouseDetail?.content?.trim() || coinbaseDetail?.content?.trim() || null;
}

async function fetchCoinbaseJobDetail(jobId: number): Promise<CoinbaseJob | null> {
  const url = buildCoinbaseJobDetailUrl(jobId);
  try {
    const res = await fetchJsonWithTimeout(url, { headers: atsJsonHeaders() });
    if (!res.ok) {
      return null;
    }
    const payload = (await res.json()) as CoinbaseJobDetailResponse;
    return payload.data ?? null;
  } catch {
    return null;
  }
}

async function fetchCoinbaseGreenhouseEmbedJob(
  boardToken: string,
  jobId: number,
): Promise<CoinbaseGreenhouseEmbedJob | null> {
  const url = buildCoinbaseGreenhouseEmbedJobUrl(boardToken, jobId);
  try {
    const res = await fetchJsonWithTimeout(url, { headers: atsJsonHeaders() });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as CoinbaseGreenhouseEmbedJob;
  } catch {
    return null;
  }
}
