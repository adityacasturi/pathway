import { atsPublishDate } from "../posted-date.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, resolveBoardToken, safeToIsoDate } from "./shared.ts";

/**
 * PEAK6 careers use Ongig (careers.peak6.com / peak6-prod.ongig.com).
 * Job search is backed by text-analyzer.ongig.com (public bearer in careers embed JS).
 */
export const PEAK6_CAREERS_URL = "https://www.peak6.com/careers/";
export const PEAK6_JOBS_ORIGIN = "https://peak6-prod.ongig.com";
export const PEAK6_ONGIG_SEARCH_URL = "https://text-analyzer.ongig.com/api/external/v2/jobs/search";
export const PEAK6_DEFAULT_GROUP_ID = "1767";

/** Public search API bearer from peak6 Ongig embed (ongig-embed.umd.js). */
const PEAK6_ONGIG_BEARER = "1bb83b1b-7481-11df-bbeb-b11bb1cb11b4";

const PEAK6_PAGE_SIZE = 100;
const PEAK6_MAX_PAGES = 5;

const INTERNSHIP_LIST_TITLE_PATTERN =
  /\bintern(?:ship|ships)?\b|\bco-?op\b|\bfellowship\b|\buniversity\b|\bbootcamp\b/i;

export interface Peak6BoardConfig {
  groupId: string;
  jobsOrigin: string;
  searchUrl: string;
}

interface OngigRawField {
  raw?: string | null;
}

export interface OngigJobResult {
  id?: OngigRawField;
  title?: OngigRawField;
  location?: OngigRawField;
  url?: OngigRawField;
  content?: OngigRawField;
  category?: OngigRawField;
  subdivision?: OngigRawField;
  job_type?: OngigRawField;
  created_at?: OngigRawField;
}

interface OngigSearchResponse {
  meta?: {
    page?: {
      current?: number;
      total_pages?: number;
      total_results?: number;
      size?: number;
    };
  };
  results?: OngigJobResult[];
}

export function createPeak6Adapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolvePeak6Board(source);
  const resolvedSource =
    source.boardToken === board.groupId ? source : { ...source, boardToken: board.groupId };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const listings = await fetchAllPeak6Listings(board);
      const candidates = listings.filter((job) => isPeak6ListCandidate(job));
      return parsePeak6Jobs(candidates, resolvedSource, board, listings.length);
    },
  };
}

export function resolvePeak6Board(source: CompanySourceConfig): Peak6BoardConfig {
  const groupId = resolveBoardToken(source, () => PEAK6_DEFAULT_GROUP_ID);
  const jobsOrigin = parsePeak6JobsOrigin(source.sourceUrl) ?? PEAK6_JOBS_ORIGIN;

  return {
    groupId,
    jobsOrigin: jobsOrigin.replace(/\/$/, ""),
    searchUrl: PEAK6_ONGIG_SEARCH_URL,
  };
}

export function parsePeak6JobsOrigin(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    const host = parsed.hostname.toLowerCase();
    if (host === "peak6-prod.ongig.com" || host === "careers.peak6.com") {
      return `${parsed.protocol}//${parsed.host}`;
    }
    return null;
  } catch {
    return null;
  }
}

export function isPeak6ListCandidate(job: OngigJobResult): boolean {
  return INTERNSHIP_LIST_TITLE_PATTERN.test(readOngigField(job.title) ?? "");
}

export function buildPeak6PostingUrl(board: Peak6BoardConfig, job: OngigJobResult): string {
  const path = readOngigField(job.url)?.replace(/^\//, "");
  if (!path) {
    return "";
  }
  return `${board.jobsOrigin}/jobs/${path}`;
}

export function readOngigField(field: OngigRawField | undefined): string | null {
  const value = field?.raw?.trim();
  return value || null;
}

export function parsePeak6SearchResponse(payload: unknown, url: string): OngigSearchResponse {
  if (!payload || typeof payload !== "object") {
    throw new Error(`Peak6 Ongig search response was not JSON for ${url}`);
  }
  return payload as OngigSearchResponse;
}

export function parsePeak6Jobs(
  jobs: OngigJobResult[],
  source: CompanySourceConfig,
  board: Peak6BoardConfig,
  fetchedCount: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const job of jobs) {
    const roleName = readOngigField(job.title) ?? "";
    const plainDescription = htmlToPlainText(readOngigField(job.content) ?? "");
    const location = readOngigField(job.location);
    const postingUrl = buildPeak6PostingUrl(board, job);

    const classification = classifyForSource(source, {
      title: roleName,
      description: plainDescription,
      employmentType: readOngigField(job.job_type),
      locations: location ? [location] : [],
      departments: [readOngigField(job.category), readOngigField(job.subdivision)].filter(
        (value): value is string => Boolean(value),
      ),
    });

    if (!classification.include) {
      if (roleName) {
        rejected.push({ title: roleName, reason: classification.reason });
      }
      continue;
    }

    if (!postingUrl || !isHttpUrl(postingUrl)) {
      if (roleName) {
        rejected.push({ title: roleName, reason: "missing_posting_url" });
      }
      continue;
    }

    roles.push(
      buildScrapedRole({
        postingUrl,
        roleName,
        companyName: source.companyName,
        companySlug: source.companySlug,
        classification,
        description: "",
        dates: atsPublishDate(safeToIsoDate(readOngigField(job.created_at))),
      }),
    );
  }

  return {
    roles,
    stats: {
      fetched: fetchedCount,
      kept: roles.length,
      rejected,
    },
  };
}

function buildPeak6SearchBody(board: Peak6BoardConfig, page: number): string {
  return JSON.stringify({
    query: "",
    search_fields: {
      title: {},
      location: {},
      category: {},
      content: {},
      subdivision: {},
    },
    result_fields: {
      title: { raw: {} },
      location: { raw: {} },
      url: { raw: {} },
      id: { raw: {} },
      category: { raw: {} },
      subdivision: { raw: {} },
      content: { raw: {} },
      job_type: { raw: {} },
      created_at: { raw: {} },
    },
    precision: 2,
    page: { size: PEAK6_PAGE_SIZE, current: page },
    filters: {
      all: [{ any: [{ live: 1 }] }, { any: [{ group_id: Number(board.groupId) }] }],
    },
    facets: {
      subdivision: { type: "value", size: 30 },
      category: { type: "value", size: 30 },
      location: { type: "value", size: 30 },
    },
  });
}

async function fetchPeak6SearchPage(board: Peak6BoardConfig, page: number): Promise<OngigSearchResponse> {
  const response = await fetchJsonWithTimeout(board.searchUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${PEAK6_ONGIG_BEARER}`,
    },
    body: buildPeak6SearchBody(board, page),
  });

  if (!response.ok) {
    throw new Error(`Peak6 Ongig search HTTP ${response.status} for page ${page}`);
  }

  return parsePeak6SearchResponse(await response.json(), board.searchUrl);
}

async function fetchAllPeak6Listings(board: Peak6BoardConfig): Promise<OngigJobResult[]> {
  const listings: OngigJobResult[] = [];
  const seenIds = new Set<string>();

  for (let page = 1; page <= PEAK6_MAX_PAGES; page += 1) {
    const payload = await fetchPeak6SearchPage(board, page);
    const results = payload.results ?? [];
    const totalPages = payload.meta?.page?.total_pages ?? 1;

    for (const job of results) {
      const id = readOngigField(job.id);
      if (id && seenIds.has(id)) {
        continue;
      }
      if (id) {
        seenIds.add(id);
      }
      listings.push(job);
    }

    if (page >= totalPages || results.length === 0) {
      break;
    }
  }

  return listings;
}
