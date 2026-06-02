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
 * Millennium Management careers run on Eightfold (mlp.eightfold.ai / campusjobs.mlp.com).
 * PCSX search is disabled on this tenant; open roles are embedded in #smartApplyData on SSR pages.
 */
export const MILLENNIUM_CAREERS_ORIGIN = "https://mlp.eightfold.ai";
export const MILLENNIUM_DEFAULT_DOMAIN = "mlp.com";
export const MILLENNIUM_DEFAULT_MICROSITE = "campus-site";
export const MILLENNIUM_DEFAULT_SOURCE_URL = `${MILLENNIUM_CAREERS_ORIGIN}/careers?microsite=${MILLENNIUM_DEFAULT_MICROSITE}&query=intern`;

export const MILLENNIUM_DEFAULT_SEARCH_QUERIES = [
  "intern",
  "internship",
  "summer intern",
  "winter intern",
  "spring intern",
  "fall intern",
  "co-op",
  "university",
];

const MILLENNIUM_DETAIL_CONCURRENCY = 6;
const MILLENNIUM_REQUEST_DELAY_MS = 250;

const SMART_APPLY_DATA_PATTERN =
  /<code id="smartApplyData"[^>]*>([\s\S]*?)<\/code>/i;

/** List titles must look internship-related before we fetch full descriptions. */
export interface MillenniumBoardConfig {
  domain: string;
  careersOrigin: string;
  microsite: string | null;
  searchQueries: string[];
}

export interface MillenniumPositionSummary {
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
  display_job_id?: string;
}

export interface MillenniumJobDetail {
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

interface MillenniumEnrichedPosting {
  summary: MillenniumPositionSummary;
  detail: MillenniumJobDetail | null;
}

export function createMillenniumAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveMillenniumBoard(source);
  const resolvedSource =
    source.boardToken === board.domain ? source : { ...source, boardToken: board.domain };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const summaries = await fetchAllMillenniumSummaries(board);
      const candidates = summaries.filter((summary) =>
        INTERNSHIP_LIST_TITLE_PATTERN.test(summary.name?.trim() ?? ""),
      );
      const enriched = await enrichMillenniumPostings(board, candidates);
      return parseMillenniumPostings(enriched, resolvedSource, board, summaries.length);
    },
  };
}

export function resolveMillenniumBoard(source: CompanySourceConfig): MillenniumBoardConfig {
  const domain = normalizeMillenniumDomain(source.boardToken) ?? MILLENNIUM_DEFAULT_DOMAIN;
  const careersOrigin = parseMillenniumCareersOrigin(source.sourceUrl) ?? MILLENNIUM_CAREERS_ORIGIN;
  const microsite = parseMillenniumMicrosite(source.sourceUrl) ?? MILLENNIUM_DEFAULT_MICROSITE;
  const searchQueries = parseMillenniumSearchQueries(source.sourceUrl);

  return {
    domain,
    careersOrigin,
    microsite,
    searchQueries: searchQueries.length > 0 ? searchQueries : MILLENNIUM_DEFAULT_SEARCH_QUERIES,
  };
}

export function parseMillenniumSmartApplyHtml(html: string): MillenniumPositionSummary[] {
  const match = html.match(SMART_APPLY_DATA_PATTERN);
  if (!match?.[1]) {
    return [];
  }

  const payload = JSON.parse(decodeMillenniumHtmlEntities(match[1])) as {
    positions?: MillenniumPositionSummary[];
  };

  const positions = payload.positions;
  if (!Array.isArray(positions)) {
    return [];
  }

  return positions.filter((position) => typeof position.id === "number");
}

export function buildMillenniumSearchUrl(board: MillenniumBoardConfig, query: string): string {
  const url = new URL(`${board.careersOrigin}/careers`);
  if (board.microsite) {
    url.searchParams.set("microsite", board.microsite);
  }
  url.searchParams.set("domain", board.domain);

  const trimmed = query.trim();
  if (trimmed) {
    url.searchParams.set("query", trimmed);
  }

  return url.toString();
}

export function buildMillenniumDetailUrl(board: MillenniumBoardConfig, positionId: number): string {
  return `${board.careersOrigin}/api/apply/v2/jobs/${positionId}?domain=${encodeURIComponent(board.domain)}`;
}

export function buildMillenniumPostingUrl(
  board: MillenniumBoardConfig,
  summary: MillenniumPositionSummary,
  detail: MillenniumJobDetail | null,
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

export function formatMillenniumLocations(
  summary: MillenniumPositionSummary,
  detail: MillenniumJobDetail | null | undefined,
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

export function parseMillenniumPostings(
  postings: MillenniumEnrichedPosting[],
  source: CompanySourceConfig,
  board: MillenniumBoardConfig,
  fetchedTotal: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const posting of postings) {
    const summary = posting.summary;
    const detail = posting.detail;
    const roleName = (detail?.name ?? summary.name)?.trim() || "";
    const description = detail?.job_description ? htmlToPlainText(detail.job_description) : "";
    const locations = formatMillenniumLocations(summary, detail);
    const postingUrl = buildMillenniumPostingUrl(board, summary, detail);
    const departments = [summary.department, summary.business_unit, detail?.department, detail?.business_unit]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value));

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

async function fetchAllMillenniumSummaries(board: MillenniumBoardConfig): Promise<MillenniumPositionSummary[]> {
  const byId = new Map<number, MillenniumPositionSummary>();

  for (const query of board.searchQueries) {
    const positions = await fetchMillenniumSearchPage(board, query);
    for (const position of positions) {
      if (typeof position.id === "number") {
        byId.set(position.id, position);
      }
    }
    await scraperDelay(MILLENNIUM_REQUEST_DELAY_MS);
  }

  return Array.from(byId.values());
}

async function fetchMillenniumSearchPage(
  board: MillenniumBoardConfig,
  query: string,
): Promise<MillenniumPositionSummary[]> {
  const url = buildMillenniumSearchUrl(board, query);
  const html = await fetchMillenniumHtml(url);
  return parseMillenniumSmartApplyHtml(html);
}

async function enrichMillenniumPostings(
  board: MillenniumBoardConfig,
  summaries: MillenniumPositionSummary[],
): Promise<MillenniumEnrichedPosting[]> {
  return mapWithConcurrency(summaries, MILLENNIUM_DETAIL_CONCURRENCY, async (summary) => {
    const positionId = summary.id;
    if (typeof positionId !== "number") {
      return { summary, detail: null };
    }

    try {
      const detailUrl = buildMillenniumDetailUrl(board, positionId);
      const res = await fetchJsonWithTimeout(detailUrl);
      if (!res.ok) {
        return { summary, detail: null };
      }
      const payload = (await res.json()) as MillenniumJobDetail;
      return { summary, detail: payload ?? null };
    } catch {
      return { summary, detail: null };
    }
  });
}

async function fetchMillenniumHtml(url: string): Promise<string> {
  const res = await fetchJsonWithTimeout(url, {
    headers: { accept: "text/html,application/xhtml+xml" },
  });
  if (!res.ok) {
    throw new Error(`Millennium careers returned ${res.status} for ${url}`);
  }
  return res.text();
}

function parseMillenniumCareersOrigin(sourceUrl: string): string | null {
  const trimmed = sourceUrl.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const hostname = new URL(trimmed).hostname.toLowerCase();
    if (
      hostname === "mlp.eightfold.ai" ||
      hostname === "campusjobs.mlp.com" ||
      hostname === "career.mlp.com" ||
      hostname === "www.mlp.com"
    ) {
      return MILLENNIUM_CAREERS_ORIGIN;
    }
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

function parseMillenniumMicrosite(sourceUrl: string): string | null {
  try {
    const microsite = new URL(sourceUrl).searchParams.get("microsite")?.trim();
    return microsite || null;
  } catch {
    return null;
  }
}

function parseMillenniumSearchQueries(sourceUrl: string): string[] {
  try {
    const parsed = new URL(sourceUrl);
    const query = parsed.searchParams.get("query")?.trim();
    return query ? [query] : [];
  } catch {
    return [];
  }
}

function normalizeMillenniumDomain(boardToken: string | null | undefined): string | null {
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

function decodeMillenniumHtmlEntities(value: string): string {
  return value
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

