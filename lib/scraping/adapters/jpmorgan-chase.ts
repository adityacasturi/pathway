import { randomUUID } from "node:crypto";
import { atsPublishDate, unknownScrapedDates } from "../posted-date.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { formatPrimaryWithCountryCode } from "../location.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, safeToIsoDate, scraperDelay } from "./shared.ts";
import { mapWithConcurrency } from "../scrape-concurrency.ts";

/** Oracle Fusion Candidate Experience (public REST) at jpmc.fa.oraclecloud.com. */
export const JPMORGAN_ORACLE_ORIGIN = "https://jpmc.fa.oraclecloud.com";
export const JPMORGAN_DEFAULT_SITE_NUMBER = "CX_1001";
export const JPMORGAN_DEFAULT_CAREERS_URL = `${JPMORGAN_ORACLE_ORIGIN}/hcmUI/CandidateExperience/en/sites/${JPMORGAN_DEFAULT_SITE_NUMBER}`;
export const JPMORGAN_REQUISITIONS_URL = `${JPMORGAN_ORACLE_ORIGIN}/hcmRestApi/resources/latest/recruitingCEJobRequisitions`;
export const JPMORGAN_DETAILS_URL = `${JPMORGAN_ORACLE_ORIGIN}/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails`;

const JPMORGAN_PAGE_SIZE = 25;
const JPMORGAN_MAX_PAGES = 80;
const JPMORGAN_SEARCH_KEYWORD = "intern";
const JPMORGAN_DETAIL_CONCURRENCY = 4;
const JPMORGAN_REQUEST_DELAY_MS = 400;
const JPMORGAN_FACETS_LIST =
  "LOCATIONS;WORK_LOCATIONS;WORKPLACE_TYPES;TITLES;CATEGORIES;ORGANIZATIONS;POSTING_DATES;FLEX_FIELDS";

/** List titles must look internship-related before we fetch full descriptions. */
const INTERNSHIP_LIST_TITLE_PATTERN =
  /\bintern(?:ship|ships)?\b|\bco-?op\b|\bfellowship\b|\buniversity\b|\bsummer\s+analyst\b/i;

export interface JpmorganBoardConfig {
  siteNumber: string;
  careersOrigin: string;
  requisitionsUrl: string;
  detailsUrl: string;
  localePath: string;
}

export interface JpmorganRequisitionSummary {
  Id?: string;
  Title?: string;
  PostedDate?: string;
  PrimaryLocation?: string;
  PrimaryLocationCountry?: string;
  JobFamily?: string;
  ShortDescriptionStr?: string;
}

interface JpmorganSearchItem {
  requisitionList?: JpmorganRequisitionSummary[];
  TotalJobsCount?: number;
}

interface JpmorganSearchResponse {
  items?: JpmorganSearchItem[];
}

export interface JpmorganRequisitionDetail {
  Id?: string;
  Title?: string;
  Category?: string;
  JobFunction?: string;
  ExternalPostedStartDate?: string;
  ExternalDescriptionStr?: string;
  ExternalQualificationsStr?: string;
  ExternalResponsibilitiesStr?: string;
  ShortDescriptionStr?: string;
  PrimaryLocation?: string;
  PrimaryLocationCountry?: string;
}

interface JpmorganDetailResponse {
  items?: JpmorganRequisitionDetail[];
}

interface JpmorganEnrichedPosting {
  summary: JpmorganRequisitionSummary;
  detail: JpmorganRequisitionDetail | null;
}

export function createJpmorganChaseAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveJpmorganBoard(source);
  const resolvedSource =
    source.boardToken === board.siteNumber && source.sourceUrl.startsWith(JPMORGAN_ORACLE_ORIGIN)
      ? source
      : { ...source, sourceUrl: board.careersOrigin, boardToken: board.siteNumber };

  const sessionUserId = randomUUID();

  return {
    source: resolvedSource,
    async fetchRoles() {
      const summaries = await fetchAllJpmorganSummaries(board);
      const candidates = summaries.filter((summary) => isJpmorganListCandidate(summary));
      const enriched = await enrichJpmorganPostings(board, candidates, sessionUserId);
      return parseJpmorganPostings(enriched, resolvedSource, board, summaries.length);
    },
  };
}

export function resolveJpmorganBoard(source: CompanySourceConfig): JpmorganBoardConfig {
  const fromUrl = parseJpmorganCareersUrl(source.sourceUrl);
  const siteNumber = source.boardToken?.trim() || fromUrl?.siteNumber || JPMORGAN_DEFAULT_SITE_NUMBER;
  const localePath = fromUrl?.localePath ?? `en/sites/${siteNumber}`;
  const careersOrigin = `${JPMORGAN_ORACLE_ORIGIN}/hcmUI/CandidateExperience/${localePath}`;

  return {
    siteNumber,
    careersOrigin,
    requisitionsUrl: JPMORGAN_REQUISITIONS_URL,
    detailsUrl: JPMORGAN_DETAILS_URL,
    localePath,
  };
}

export function parseJpmorganCareersUrl(
  sourceUrl: string,
): { siteNumber: string; localePath: string } | null {
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.hostname.toLowerCase() !== "jpmc.fa.oraclecloud.com") {
      return null;
    }

    const segments = parsed.pathname
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean);

    const sitesIndex = segments.indexOf("sites");
    if (sitesIndex >= 0 && segments[sitesIndex + 1]) {
      const siteNumber = segments[sitesIndex + 1];
      const localePath = segments.slice(segments.indexOf("CandidateExperience") + 1).join("/");
      return { siteNumber, localePath: localePath || `en/sites/${siteNumber}` };
    }

    return null;
  } catch {
    return null;
  }
}

export function buildJpmorganRequisitionsFinder(
  board: JpmorganBoardConfig,
  offset: number,
  keyword: string = JPMORGAN_SEARCH_KEYWORD,
): string {
  const params = [
    `siteNumber=${board.siteNumber}`,
    `facetsList=${JPMORGAN_FACETS_LIST}`,
    `limit=${JPMORGAN_PAGE_SIZE}`,
    `offset=${offset}`,
    `keyword=${keyword}`,
  ].join(",");

  return `findReqs;${params}`;
}

export function buildJpmorganDetailsFinder(board: JpmorganBoardConfig, requisitionId: string): string {
  return `ById;Id="${requisitionId}",siteNumber=${board.siteNumber}`;
}

export function buildJpmorganPostingUrl(
  board: JpmorganBoardConfig,
  requisitionId: string,
): string {
  return `${board.careersOrigin}/job/${requisitionId}`;
}

export function formatJpmorganDescription(
  summary: JpmorganRequisitionSummary,
  detail: JpmorganRequisitionDetail | null | undefined,
): string {
  const parts = [
    detail?.ExternalDescriptionStr,
    detail?.ExternalResponsibilitiesStr,
    detail?.ExternalQualificationsStr,
    detail?.ShortDescriptionStr,
    summary.ShortDescriptionStr,
  ]
    .map((part) => htmlToPlainText(part ?? ""))
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.join("\n\n");
}

export function formatJpmorganLocations(
  summary: JpmorganRequisitionSummary,
  detail: JpmorganRequisitionDetail | null | undefined,
): string[] {
  const primary = detail?.PrimaryLocation?.trim() || summary.PrimaryLocation?.trim() || "";
  const country =
    detail?.PrimaryLocationCountry?.trim() || summary.PrimaryLocationCountry?.trim() || "";

  return formatPrimaryWithCountryCode(primary, country);
}

export function isJpmorganListCandidate(summary: JpmorganRequisitionSummary): boolean {
  const title = summary.Title?.trim() ?? "";
  if (/\binternal\b|\binternational\b/i.test(title) && !INTERNSHIP_LIST_TITLE_PATTERN.test(title)) {
    return false;
  }

  return INTERNSHIP_LIST_TITLE_PATTERN.test(title);
}

export function parseJpmorganPostings(
  postings: JpmorganEnrichedPosting[],
  source: CompanySourceConfig,
  board: JpmorganBoardConfig,
  fetchedTotal: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const posting of postings) {
    const summary = posting.summary;
    const detail = posting.detail;
    const roleName = (detail?.Title ?? summary.Title)?.trim() || "";
    const requisitionId = (detail?.Id ?? summary.Id)?.trim() || "";
    const description = formatJpmorganDescription(summary, detail);
    const locations = formatJpmorganLocations(summary, detail);
    const postingUrl = requisitionId ? buildJpmorganPostingUrl(board, requisitionId) : "";

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      departments: [detail?.Category, detail?.JobFunction, summary.JobFamily].filter(
        (value): value is string => Boolean(value?.trim()),
      ),
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

    const posted =
      detail?.ExternalPostedStartDate?.trim() || summary.PostedDate?.trim() || null;

    roles.push(
      buildScrapedRole({
        postingUrl,
        roleName,
        companyName: source.companyName,
        companySlug: source.companySlug,
        classification,
        description: formatJpmorganDescription(summary, detail),
        dates: posted ? atsPublishDate(safeToIsoDate(posted)) : unknownScrapedDates(),
      }),
    );
  }

  return buildRoleParseResult(fetchedTotal, roles, rejected);
}

export function parseJpmorganSearchResponse(payload: unknown, url: string): JpmorganRequisitionSummary[] {
  if (!payload || typeof payload !== "object") {
    throw new Error(`JPMorgan search response was not JSON for ${url}`);
  }

  const items = (payload as JpmorganSearchResponse).items;
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const list = items[0]?.requisitionList;
  if (!Array.isArray(list)) {
    throw new Error(`JPMorgan search response was not in expected format for ${url}`);
  }

  return list;
}

export function parseJpmorganDetailResponse(payload: unknown, url: string): JpmorganRequisitionDetail | null {
  if (!payload || typeof payload !== "object") {
    throw new Error(`JPMorgan detail response was not JSON for ${url}`);
  }

  const items = (payload as JpmorganDetailResponse).items;
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return items[0] ?? null;
}

async function fetchAllJpmorganSummaries(board: JpmorganBoardConfig): Promise<JpmorganRequisitionSummary[]> {
  const summaries: JpmorganRequisitionSummary[] = [];
  let offset = 0;
  let total: number | null = null;

  for (let page = 0; page < JPMORGAN_MAX_PAGES; page++) {
    const batch = await fetchJpmorganSearchPage(board, offset);
    if (typeof batch.total === "number" && batch.total > 0) {
      total = batch.total;
    }

    summaries.push(...batch.summaries);

    if (batch.summaries.length === 0) {
      break;
    }

    offset += batch.summaries.length;
    if (total !== null && offset >= total) {
      break;
    }
    if (total === null && batch.summaries.length < JPMORGAN_PAGE_SIZE) {
      break;
    }

    await scraperDelay(JPMORGAN_REQUEST_DELAY_MS);
  }

  return summaries;
}

async function fetchJpmorganSearchPage(
  board: JpmorganBoardConfig,
  offset: number,
): Promise<{ summaries: JpmorganRequisitionSummary[]; total: number | null }> {
  const url = new URL(board.requisitionsUrl);
  url.searchParams.set("expand", "all");
  url.searchParams.set("onlyData", "true");
  url.searchParams.set("finder", buildJpmorganRequisitionsFinder(board, offset));

  const res = await fetchJsonWithTimeout(url.toString());
  if (!res.ok) {
    throw new Error(`JPMorgan search returned ${res.status} for ${url.toString()}`);
  }

  const payload = (await res.json()) as unknown;
  const summaries = parseJpmorganSearchResponse(payload, url.toString());
  const total =
    payload && typeof payload === "object" && Array.isArray((payload as JpmorganSearchResponse).items)
      ? ((payload as JpmorganSearchResponse).items?.[0]?.TotalJobsCount ?? null)
      : null;

  return { summaries, total };
}

async function enrichJpmorganPostings(
  board: JpmorganBoardConfig,
  summaries: JpmorganRequisitionSummary[],
  sessionUserId: string,
): Promise<JpmorganEnrichedPosting[]> {
  return mapWithConcurrency(summaries, JPMORGAN_DETAIL_CONCURRENCY, async (summary) => {
    const requisitionId = summary.Id?.trim();
    if (!requisitionId) {
      return { summary, detail: null };
    }

    try {
      const detail = await fetchJpmorganDetail(board, requisitionId, sessionUserId);
      return { summary, detail };
    } catch {
      return { summary, detail: null };
    }
  });
}

async function fetchJpmorganDetail(
  board: JpmorganBoardConfig,
  requisitionId: string,
  sessionUserId: string,
): Promise<JpmorganRequisitionDetail | null> {
  const url = new URL(board.detailsUrl);
  url.searchParams.set("expand", "all");
  url.searchParams.set("onlyData", "true");
  url.searchParams.set("finder", buildJpmorganDetailsFinder(board, requisitionId));

  const res = await fetchJsonWithTimeout(url.toString(), {
    headers: jpmorganOracleHeaders(sessionUserId),
  });

  if (!res.ok) {
    return null;
  }

  const payload = (await res.json()) as unknown;
  return parseJpmorganDetailResponse(payload, url.toString());
}

export function jpmorganOracleHeaders(sessionUserId: string): HeadersInit {
  return {
    accept: "application/json",
    "content-type": "application/vnd.oracle.adf.resourceitem+json;charset=utf-8",
    "ora-irc-cx-userid": sessionUserId,
    "ora-irc-language": "en",
  };
}

