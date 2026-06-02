import { atsPublishDate, unknownScrapedDates } from "../posted-date.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, safeToIsoDate, scraperDelay } from "./shared.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";
import { mapWithConcurrency } from "../scrape-concurrency.ts";

/**
 * Netflix careers run on Phenom/Eightfold (explore.jobs.netflix.net).
 * Search results are server-rendered into the careers HTML; job detail uses apply v2 JSON.
 */
export const NETFLIX_CAREERS_ORIGIN = "https://explore.jobs.netflix.net";
export const NETFLIX_DEFAULT_DOMAIN = "netflix.com";
export const NETFLIX_DEFAULT_SOURCE_URL = `${NETFLIX_CAREERS_ORIGIN}/careers?query=intern`;

export const NETFLIX_DEFAULT_SEARCH_QUERIES = [
  "intern",
  "internship",
  "phd intern",
  "summer intern",
  "winter intern",
  "spring intern",
  "fall intern",
  "co-op",
  "university",
];

const NETFLIX_DETAIL_CONCURRENCY = 6;
const NETFLIX_REQUEST_DELAY_MS = 250;

/** List titles must look internship-related before we fetch full descriptions. */
export interface NetflixBoardConfig {
  domain: string;
  careersOrigin: string;
  searchQueries: string[];
}

export interface NetflixPositionSummary {
  id: number;
  name?: string;
  posting_name?: string;
  location?: string;
  locations?: string[];
  department?: string;
  business_unit?: string;
  t_update?: number;
  t_create?: number;
  canonicalPositionUrl?: string;
}

export interface NetflixJobDetail {
  id?: number;
  name?: string;
  job_description?: string;
  department?: string;
  business_unit?: string;
  locations?: string[];
  location?: string;
  t_update?: number;
  t_create?: number;
  canonicalPositionUrl?: string;
}

interface NetflixEnrichedPosting {
  summary: NetflixPositionSummary;
  detail: NetflixJobDetail | null;
}

export function createNetflixAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveNetflixBoard(source);
  const resolvedSource =
    source.boardToken === board.domain ? source : { ...source, boardToken: board.domain };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const summaries = await fetchAllNetflixSummaries(board);
      const candidates = summaries.filter((summary) =>
        INTERNSHIP_LIST_TITLE_PATTERN.test(summary.name?.trim() ?? ""),
      );
      const enriched = await enrichNetflixPostings(board, candidates);
      return parseNetflixPostings(enriched, resolvedSource, board, summaries.length);
    },
  };
}

export function resolveNetflixBoard(source: CompanySourceConfig): NetflixBoardConfig {
  const domain = normalizeNetflixDomain(source.boardToken) ?? NETFLIX_DEFAULT_DOMAIN;
  const careersOrigin = parseNetflixCareersOrigin(source.sourceUrl) ?? NETFLIX_CAREERS_ORIGIN;
  const searchQueries = parseNetflixSearchQueries(source.sourceUrl);

  return {
    domain,
    careersOrigin,
    searchQueries: searchQueries.length > 0 ? searchQueries : NETFLIX_DEFAULT_SEARCH_QUERIES,
  };
}

export function parseNetflixCareersHtml(html: string): NetflixPositionSummary[] {
  const decoded = decodeNetflixHtmlEntities(html);
  const start = decoded.indexOf('"positions":');
  if (start < 0) {
    return [];
  }

  const arrayStart = decoded.indexOf("[", start);
  if (arrayStart < 0) {
    return [];
  }

  let depth = 0;
  for (let index = arrayStart; index < decoded.length; index++) {
    const char = decoded[index];
    if (char === "[") {
      depth += 1;
    } else if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        const payload = JSON.parse(decoded.slice(arrayStart, index + 1)) as unknown;
        if (!Array.isArray(payload)) {
          throw new Error("Netflix careers positions payload was not an array");
        }
        return payload as NetflixPositionSummary[];
      }
    }
  }

  throw new Error("Netflix careers HTML did not contain a complete positions array");
}

export function buildNetflixSearchUrl(board: NetflixBoardConfig, query: string): string {
  const url = new URL(`${board.careersOrigin}/careers`);
  const trimmed = query.trim();
  if (trimmed) {
    url.searchParams.set("query", trimmed);
  }
  return url.toString();
}

export function buildNetflixDetailUrl(board: NetflixBoardConfig, positionId: number): string {
  return `${board.careersOrigin}/api/apply/v2/jobs/${positionId}?domain=${encodeURIComponent(board.domain)}`;
}

export function buildNetflixPostingUrl(
  board: NetflixBoardConfig,
  summary: NetflixPositionSummary,
  detail: NetflixJobDetail | null,
): string | null {
  const canonical = detail?.canonicalPositionUrl?.trim() || summary.canonicalPositionUrl?.trim();
  if (canonical && isHttpUrl(canonical)) {
    return canonical;
  }

  if (summary.id) {
    return `${board.careersOrigin}/careers/job/${summary.id}`;
  }

  return null;
}

export function formatNetflixLocations(
  summary: NetflixPositionSummary,
  detail: NetflixJobDetail | null | undefined,
): string[] {
  const fromDetail = (detail?.locations ?? []).map((location) => location.trim()).filter(Boolean);
  if (fromDetail.length > 0) {
    return Array.from(new Set(fromDetail));
  }

  const fromSummary = (summary.locations ?? []).map((location) => location.trim()).filter(Boolean);
  if (fromSummary.length > 0) {
    return Array.from(new Set(fromSummary));
  }

  const primary = detail?.location?.trim() || summary.location?.trim() || "";
  return primary ? [primary] : [];
}

export function parseNetflixPostings(
  postings: NetflixEnrichedPosting[],
  source: CompanySourceConfig,
  board: NetflixBoardConfig,
  fetchedTotal: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const posting of postings) {
    const summary = posting.summary;
    const detail = posting.detail;
    const roleName = (detail?.name ?? summary.name)?.trim() || "";
    const description = detail?.job_description ? htmlToPlainText(detail.job_description) : "";
    const locations = formatNetflixLocations(summary, detail);
    const postingUrl = buildNetflixPostingUrl(board, summary, detail);

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      departments: summary.department ? [summary.department] : [],
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

    const postedTs = summary.t_update ?? detail?.t_update ?? summary.t_create ?? detail?.t_create ?? null;

    roles.push(
      buildScrapedRole({
        postingUrl,
        roleName,
        companyName: source.companyName,
        companySlug: source.companySlug,
        classification,
        description: detail?.job_description ? htmlToPlainText(detail.job_description) : "",
        dates: postedTs ? atsPublishDate(safeToIsoDate(new Date(postedTs * 1000))) : unknownScrapedDates(),
      }),
    );
  }

  return buildRoleParseResult(fetchedTotal, roles, rejected);
}

async function fetchAllNetflixSummaries(board: NetflixBoardConfig): Promise<NetflixPositionSummary[]> {
  const byId = new Map<number, NetflixPositionSummary>();

  for (const query of board.searchQueries) {
    const positions = await fetchNetflixSearchPage(board, query);
    for (const position of positions) {
      if (typeof position.id === "number") {
        byId.set(position.id, position);
      }
    }
    await scraperDelay(NETFLIX_REQUEST_DELAY_MS);
  }

  return Array.from(byId.values());
}

async function fetchNetflixSearchPage(
  board: NetflixBoardConfig,
  query: string,
): Promise<NetflixPositionSummary[]> {
  const url = buildNetflixSearchUrl(board, query);
  const html = await fetchNetflixHtml(url);
  return parseNetflixCareersHtml(html);
}

async function enrichNetflixPostings(
  board: NetflixBoardConfig,
  summaries: NetflixPositionSummary[],
): Promise<NetflixEnrichedPosting[]> {
  return mapWithConcurrency(summaries, NETFLIX_DETAIL_CONCURRENCY, async (summary) => {
    const positionId = summary.id;
    if (typeof positionId !== "number") {
      return { summary, detail: null };
    }

    try {
      const detailUrl = buildNetflixDetailUrl(board, positionId);
      const res = await fetchJsonWithTimeout(detailUrl);
      if (!res.ok) {
        return { summary, detail: null };
      }
      const payload = (await res.json()) as NetflixJobDetail;
      return { summary, detail: payload ?? null };
    } catch {
      return { summary, detail: null };
    }
  });
}

async function fetchNetflixHtml(url: string): Promise<string> {
  const res = await fetchJsonWithTimeout(url, {
    headers: { accept: "text/html,application/xhtml+xml" },
  });
  if (!res.ok) {
    throw new Error(`Netflix careers returned ${res.status} for ${url}`);
  }
  return res.text();
}

function parseNetflixCareersOrigin(sourceUrl: string): string | null {
  const trimmed = sourceUrl.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const hostname = new URL(trimmed).hostname.toLowerCase();
    if (hostname === "explore.jobs.netflix.net" || hostname === "jobs.netflix.com") {
      return NETFLIX_CAREERS_ORIGIN;
    }
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

function parseNetflixSearchQueries(sourceUrl: string): string[] {
  try {
    const parsed = new URL(sourceUrl);
    const query = parsed.searchParams.get("query")?.trim();
    return query ? [query] : [];
  } catch {
    return [];
  }
}

function normalizeNetflixDomain(boardToken: string | null | undefined): string | null {
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

function decodeNetflixHtmlEntities(html: string): string {
  return html
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

