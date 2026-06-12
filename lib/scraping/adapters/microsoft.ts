import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { looksLikeGeographicLocation, normalizeScrapedLocations } from "../location.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, scraperDelay } from "./shared.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";
import { mapWithConcurrency } from "../scrape-concurrency.ts";

/** Eightfold PCSX search API used by apply.careers.microsoft.com. */
export const MICROSOFT_CAREERS_ORIGIN = "https://apply.careers.microsoft.com";
export const MICROSOFT_DEFAULT_DOMAIN = "microsoft.com";

const MICROSOFT_SEARCH_PATH = "/api/pcsx/search";
const MICROSOFT_PAGE_SIZE = 10;
const MICROSOFT_MAX_PAGES = 80;
const MICROSOFT_SEARCH_QUERY = "intern";
const MICROSOFT_DETAIL_CONCURRENCY = 6;
const MICROSOFT_REQUEST_DELAY_MS = 400;

/** List titles must look internship-related before we fetch full descriptions. */
export interface MicrosoftBoardConfig {
  domain: string;
  searchUrl: string;
  careersOrigin: string;
}

export interface MicrosoftPositionSummary {
  id?: number;
  displayJobId?: string;
  name?: string;
  locations?: string[];
  standardizedLocations?: string[];
  postedTs?: number;
  department?: string;
  positionUrl?: string;
  atsJobId?: string;
}

export interface MicrosoftSearchResponse {
  data?: {
    positions?: MicrosoftPositionSummary[];
  };
}

export interface MicrosoftJobDetail {
  id?: number;
  name?: string;
  job_description?: string;
  department?: string;
  locations?: string[];
  location?: string;
  t_update?: number;
  t_create?: number;
  canonicalPositionUrl?: string;
  display_job_id?: string;
}

interface MicrosoftEnrichedPosting {
  summary: MicrosoftPositionSummary;
  detail: MicrosoftJobDetail | null;
}

export function createMicrosoftAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveMicrosoftBoard(source);
  const resolvedSource =
    source.boardToken === board.domain ? source : { ...source, boardToken: board.domain };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const summaries = await fetchAllMicrosoftSummaries(board);
      const candidates = summaries.filter((summary) =>
        INTERNSHIP_LIST_TITLE_PATTERN.test(summary.name?.trim() ?? ""),
      );

      const enriched = await enrichMicrosoftPostings(board, candidates);
      return parseMicrosoftPostings(enriched, resolvedSource, board, summaries.length);
    },
  };
}

export function parsePcsxCareersOrigin(sourceUrl: string): string | null {
  const trimmed = sourceUrl.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

export function resolveMicrosoftBoard(source: CompanySourceConfig): MicrosoftBoardConfig {
  const domain = normalizeMicrosoftDomain(source.boardToken) ?? MICROSOFT_DEFAULT_DOMAIN;
  const careersOrigin = parsePcsxCareersOrigin(source.sourceUrl) ?? MICROSOFT_CAREERS_ORIGIN;

  return {
    domain,
    searchUrl: `${careersOrigin}${MICROSOFT_SEARCH_PATH}`,
    careersOrigin,
  };
}

export function buildMicrosoftPostingUrl(
  board: MicrosoftBoardConfig,
  summary: MicrosoftPositionSummary,
  detail: MicrosoftJobDetail | null,
): string | null {
  const canonical = detail?.canonicalPositionUrl?.trim();
  if (canonical && isHttpUrl(canonical)) {
    return canonical;
  }

  const path = summary.positionUrl?.trim();
  if (path?.startsWith("/")) {
    return `${board.careersOrigin}${path}`;
  }

  if (summary.id) {
    return `${board.careersOrigin}/careers/job/${summary.id}`;
  }

  return null;
}

export function buildMicrosoftDetailUrl(board: MicrosoftBoardConfig, positionId: number): string {
  return `${board.careersOrigin}/api/apply/v2/jobs/${positionId}?domain=${encodeURIComponent(board.domain)}`;
}

export function formatMicrosoftLocations(
  summary: MicrosoftPositionSummary,
  detail: MicrosoftJobDetail | null | undefined,
): string[] {
  const standardized = normalizeScrapedLocations(
    (summary.standardizedLocations ?? []).map((location) => location.trim()).filter(Boolean),
  );
  if (standardized.length > 0) {
    return standardized;
  }

  const fromSummary = normalizeScrapedLocations(
    (summary.locations ?? []).map((location) => location.trim()).filter(Boolean),
  );
  if (fromSummary.length > 0) {
    return fromSummary;
  }

  const fromDetail = normalizeScrapedLocations(
    (detail?.locations ?? []).map((location) => location.trim()).filter(Boolean),
  );
  if (fromDetail.length > 0) {
    return fromDetail;
  }

  const primary = detail?.location?.trim() || "";
  if (primary && looksLikeGeographicLocation(primary)) {
    return normalizeScrapedLocations([primary]);
  }

  return [];
}

export function parseMicrosoftPostings(
  postings: MicrosoftEnrichedPosting[],
  source: CompanySourceConfig,
  board: MicrosoftBoardConfig,
  fetchedTotal: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const posting of postings) {
    const summary = posting.summary;
    const detail = posting.detail;
    const roleName = (detail?.name ?? summary.name)?.trim() || "";
    const description = detail?.job_description ?? "";
    const locations = formatMicrosoftLocations(summary, detail);
    const postingUrl = buildMicrosoftPostingUrl(board, summary, detail);
    const departments = summary.department ? [summary.department] : [];

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      departments,
      locations,
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
        description: detail?.job_description ?? "",
      }),
    );
  }

  return buildRoleParseResult(fetchedTotal, roles, rejected);
}

async function fetchAllMicrosoftSummaries(board: MicrosoftBoardConfig): Promise<MicrosoftPositionSummary[]> {
  const summaries: MicrosoftPositionSummary[] = [];
  let start = 0;

  for (let page = 0; page < MICROSOFT_MAX_PAGES; page++) {
    const batch = await fetchMicrosoftSearchPage(board, start);
    if (batch.length === 0) {
      break;
    }

    summaries.push(...batch);
    start += batch.length;

    if (batch.length < MICROSOFT_PAGE_SIZE) {
      break;
    }

    await scraperDelay(MICROSOFT_REQUEST_DELAY_MS);
  }

  return summaries;
}

async function fetchMicrosoftSearchPage(
  board: MicrosoftBoardConfig,
  start: number,
): Promise<MicrosoftPositionSummary[]> {
  const url = new URL(board.searchUrl);
  url.searchParams.set("domain", board.domain);
  url.searchParams.set("query", MICROSOFT_SEARCH_QUERY);
  url.searchParams.set("location", "");
  url.searchParams.set("start", String(start));
  url.searchParams.set("sort_by", "timestamp");

  const res = await fetchJsonWithTimeout(url.toString());
  if (!res.ok) {
    throw new Error(`Microsoft PCSX search returned ${res.status} for ${url.toString()}`);
  }

  const payload = (await res.json()) as unknown;
  return parseMicrosoftSearchResponse(payload, url.toString());
}

export function parseMicrosoftSearchResponse(payload: unknown, url: string): MicrosoftPositionSummary[] {
  if (!payload || typeof payload !== "object") {
    throw new Error(`Microsoft PCSX response was not JSON for ${url}`);
  }

  const positions = (payload as MicrosoftSearchResponse).data?.positions;
  if (!Array.isArray(positions)) {
    throw new Error(`Microsoft PCSX response was not in expected format for ${url}`);
  }

  return positions;
}

async function enrichMicrosoftPostings(
  board: MicrosoftBoardConfig,
  summaries: MicrosoftPositionSummary[],
): Promise<MicrosoftEnrichedPosting[]> {
  return mapWithConcurrency(summaries, MICROSOFT_DETAIL_CONCURRENCY, async (summary) => {
    const positionId = summary.id;
    if (typeof positionId !== "number") {
      return { summary, detail: null };
    }

    try {
      const detailUrl = buildMicrosoftDetailUrl(board, positionId);
      const res = await fetchJsonWithTimeout(detailUrl);
      if (!res.ok) {
        return { summary, detail: null };
      }
      const payload = (await res.json()) as MicrosoftJobDetail;
      return { summary, detail: payload ?? null };
    } catch {
      return { summary, detail: null };
    }
  });
}

function normalizeMicrosoftDomain(boardToken: string | null | undefined): string | null {
  if (!boardToken) {
    return null;
  }

  const trimmed = boardToken.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes(".")) {
    return trimmed;
  }

  return `${trimmed}.com`;
}
