import { randomUUID } from "node:crypto";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { structuredPlaceFromPrimaryAndCountry } from "../structured-place.ts";
import type { StructuredPlaceInput } from "../../geo/types.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, scraperDelay } from "./shared.ts";
import { mapWithConcurrency } from "../scrape-concurrency.ts";

/** Oracle Corporation careers use Oracle Fusion CE at eeho.fa.us2.oraclecloud.com (site CX_1). */
export const ORACLE_ORIGIN = "https://eeho.fa.us2.oraclecloud.com";
/** Akamai careers vanity + API tenant (Oracle Fusion CE site CX_1). */
export const AKAMAI_ORACLE_API_ORIGIN = "https://fa-extu-saasfaprod1.fa.ocs.oraclecloud.com";
export const AKAMAI_CAREERS_VANITY_ORIGIN = "https://jobs.akamai.com";
export const ORACLE_DEFAULT_SITE_NUMBER = "CX_1";
export const ORACLE_DEFAULT_CAREERS_URL = `${ORACLE_ORIGIN}/hcmUI/CandidateExperience/en/sites/${ORACLE_DEFAULT_SITE_NUMBER}`;
export const ORACLE_REQUISITIONS_URL = `${ORACLE_ORIGIN}/hcmRestApi/resources/latest/recruitingCEJobRequisitions`;
export const ORACLE_DETAILS_URL = `${ORACLE_ORIGIN}/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails`;

export interface ParsedOracleCareersUrl {
  siteNumber: string;
  localePath: string;
  apiOrigin: string;
  careersOrigin: string;
}

const ORACLE_PAGE_SIZE = 25;
const ORACLE_MAX_PAGES = 80;
const ORACLE_SEARCH_KEYWORD = "intern";
const ORACLE_DETAIL_CONCURRENCY = 4;
const ORACLE_REQUEST_DELAY_MS = 400;
const ORACLE_FACETS_LIST =
  "LOCATIONS;WORK_LOCATIONS;WORKPLACE_TYPES;TITLES;CATEGORIES;ORGANIZATIONS;POSTING_DATES;FLEX_FIELDS";

/** List titles must look internship-related before we fetch full descriptions. */
const INTERNSHIP_LIST_TITLE_PATTERN =
  /\bintern(?:ship|ships)?\b|\bco-?op\b|\bfellowship\b|\buniversity\b|\bstudent\b/i;

export interface OracleBoardConfig {
  siteNumber: string;
  careersOrigin: string;
  requisitionsUrl: string;
  detailsUrl: string;
  localePath: string;
}

export interface OracleRequisitionSummary {
  Id?: string;
  Title?: string;
  PostedDate?: string;
  PrimaryLocation?: string;
  PrimaryLocationCountry?: string;
  JobFamily?: string;
  ShortDescriptionStr?: string;
}

interface OracleSearchItem {
  requisitionList?: OracleRequisitionSummary[];
  TotalJobsCount?: number;
}

interface OracleSearchResponse {
  items?: OracleSearchItem[];
}

export interface OracleRequisitionDetail {
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

interface OracleDetailResponse {
  items?: OracleRequisitionDetail[];
}

interface OracleEnrichedPosting {
  summary: OracleRequisitionSummary;
  detail: OracleRequisitionDetail | null;
}

export function createOracleAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveOracleBoard(source);
  const resolvedSource =
    source.boardToken === board.siteNumber && source.sourceUrl === board.careersOrigin
      ? source
      : { ...source, sourceUrl: board.careersOrigin, boardToken: board.siteNumber };

  const sessionUserId = randomUUID();

  return {
    source: resolvedSource,
    async fetchRoles() {
      const summaries = await fetchAllOracleSummaries(board);
      const candidates = summaries.filter((summary) => isOracleListCandidate(summary));
      const enriched = await enrichOraclePostings(board, candidates, sessionUserId);
      return parseOraclePostings(enriched, resolvedSource, board, summaries.length);
    },
  };
}

export function resolveOracleBoard(source: CompanySourceConfig): OracleBoardConfig {
  const fromUrl = parseOracleCareersUrl(source.sourceUrl);
  const siteNumber = source.boardToken?.trim() || fromUrl?.siteNumber || ORACLE_DEFAULT_SITE_NUMBER;
  const localePath = fromUrl?.localePath ?? `en/sites/${siteNumber}`;
  const apiOrigin = fromUrl?.apiOrigin ?? ORACLE_ORIGIN;
  const careersOrigin =
    fromUrl?.careersOrigin ?? `${apiOrigin}/hcmUI/CandidateExperience/${localePath}`;

  return {
    siteNumber,
    careersOrigin,
    requisitionsUrl: `${apiOrigin}/hcmRestApi/resources/latest/recruitingCEJobRequisitions`,
    detailsUrl: `${apiOrigin}/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails`,
    localePath,
  };
}

function extractOracleCeSiteFromPath(pathname: string): { siteNumber: string; localePath: string } | null {
  const segments = pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  const sitesIndex = segments.indexOf("sites");
  if (sitesIndex < 0 || !segments[sitesIndex + 1]) {
    return null;
  }

  const siteNumber = segments[sitesIndex + 1];
  const candidateExperienceIndex = segments.indexOf("CandidateExperience");
  const localePath =
    candidateExperienceIndex >= 0
      ? segments.slice(candidateExperienceIndex + 1).join("/")
      : segments.join("/");

  return { siteNumber, localePath: localePath || `en/sites/${siteNumber}` };
}

export function parseOracleCareersUrl(sourceUrl: string): ParsedOracleCareersUrl | null {
  try {
    const parsed = new URL(sourceUrl);
    const host = parsed.hostname.toLowerCase();

    if (host === "www.oracle.com" || host === "oracle.com") {
      const localePath = `en/sites/${ORACLE_DEFAULT_SITE_NUMBER}`;
      return {
        siteNumber: ORACLE_DEFAULT_SITE_NUMBER,
        localePath,
        apiOrigin: ORACLE_ORIGIN,
        careersOrigin: `${ORACLE_ORIGIN}/hcmUI/CandidateExperience/${localePath}`,
      };
    }

    if (host === "jobs.akamai.com") {
      const site = extractOracleCeSiteFromPath(parsed.pathname);
      if (!site) {
        return null;
      }

      return {
        ...site,
        apiOrigin: AKAMAI_ORACLE_API_ORIGIN,
        careersOrigin: `${AKAMAI_CAREERS_VANITY_ORIGIN}/${site.localePath}`,
      };
    }

    if (host.endsWith(".oraclecloud.com")) {
      const site = extractOracleCeSiteFromPath(parsed.pathname);
      if (!site) {
        return null;
      }

      const apiOrigin = `${parsed.protocol}//${parsed.host}`;
      return {
        ...site,
        apiOrigin,
        careersOrigin: `${apiOrigin}/hcmUI/CandidateExperience/${site.localePath}`,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function buildOracleRequisitionsFinder(
  board: OracleBoardConfig,
  offset: number,
  keyword: string = ORACLE_SEARCH_KEYWORD,
): string {
  const params = [
    `siteNumber=${board.siteNumber}`,
    `facetsList=${ORACLE_FACETS_LIST}`,
    `limit=${ORACLE_PAGE_SIZE}`,
    `offset=${offset}`,
    `keyword=${keyword}`,
  ].join(",");

  return `findReqs;${params}`;
}

export function buildOracleDetailsFinder(board: OracleBoardConfig, requisitionId: string): string {
  return `ById;Id="${requisitionId}",siteNumber=${board.siteNumber}`;
}

export function buildOraclePostingUrl(board: OracleBoardConfig, requisitionId: string): string {
  return `${board.careersOrigin}/job/${requisitionId}`;
}

export function formatOracleDescription(
  summary: OracleRequisitionSummary,
  detail: OracleRequisitionDetail | null | undefined,
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

export function formatOracleStructuredLocations(
  summary: OracleRequisitionSummary,
  detail: OracleRequisitionDetail | null | undefined,
): StructuredPlaceInput[] {
  const primary = detail?.PrimaryLocation?.trim() || summary.PrimaryLocation?.trim() || "";
  const country =
    detail?.PrimaryLocationCountry?.trim() || summary.PrimaryLocationCountry?.trim() || "";

  const place = structuredPlaceFromPrimaryAndCountry(primary, country);
  return place.rawLabel || place.countryCode ? [place] : [];
}

/** @deprecated Prefer {@link formatOracleStructuredLocations}. */
export function formatOracleLocations(
  summary: OracleRequisitionSummary,
  detail: OracleRequisitionDetail | null | undefined,
): string[] {
  return formatOracleStructuredLocations(summary, detail).map(
    (place) => place.rawLabel ?? place.city ?? "",
  ).filter(Boolean);
}

export function isOracleListCandidate(summary: OracleRequisitionSummary): boolean {
  const title = summary.Title?.trim() ?? "";
  if (/\binternal\b|\binternational\b/i.test(title) && !INTERNSHIP_LIST_TITLE_PATTERN.test(title)) {
    return false;
  }

  return INTERNSHIP_LIST_TITLE_PATTERN.test(title);
}

export function parseOraclePostings(
  postings: OracleEnrichedPosting[],
  source: CompanySourceConfig,
  board: OracleBoardConfig,
  fetchedTotal: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const posting of postings) {
    const summary = posting.summary;
    const detail = posting.detail;
    const roleName = (detail?.Title ?? summary.Title)?.trim() || "";
    const requisitionId = (detail?.Id ?? summary.Id)?.trim() || "";
    const description = formatOracleDescription(summary, detail);
    const structuredLocations = formatOracleStructuredLocations(summary, detail);
    const postingUrl = requisitionId ? buildOraclePostingUrl(board, requisitionId) : "";

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      departments: [detail?.Category, detail?.JobFunction, summary.JobFamily].filter(
        (value): value is string => Boolean(value?.trim()),
      ),
      structuredLocations,
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
        description: formatOracleDescription(summary, detail),
      }),
    );
  }

  return buildRoleParseResult(fetchedTotal, roles, rejected);
}

export function parseOracleSearchResponse(payload: unknown, url: string): OracleRequisitionSummary[] {
  if (!payload || typeof payload !== "object") {
    throw new Error(`Oracle search response was not JSON for ${url}`);
  }

  const items = (payload as OracleSearchResponse).items;
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const list = items[0]?.requisitionList;
  if (!Array.isArray(list)) {
    throw new Error(`Oracle search response was not in expected format for ${url}`);
  }

  return list;
}

export function parseOracleDetailResponse(payload: unknown, url: string): OracleRequisitionDetail | null {
  if (!payload || typeof payload !== "object") {
    throw new Error(`Oracle detail response was not JSON for ${url}`);
  }

  const items = (payload as OracleDetailResponse).items;
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return items[0] ?? null;
}

async function fetchAllOracleSummaries(board: OracleBoardConfig): Promise<OracleRequisitionSummary[]> {
  const summaries: OracleRequisitionSummary[] = [];
  let offset = 0;
  let total: number | null = null;

  for (let page = 0; page < ORACLE_MAX_PAGES; page++) {
    const batch = await fetchOracleSearchPage(board, offset);
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
    if (total === null && batch.summaries.length < ORACLE_PAGE_SIZE) {
      break;
    }

    await scraperDelay(ORACLE_REQUEST_DELAY_MS);
  }

  return summaries;
}

async function fetchOracleSearchPage(
  board: OracleBoardConfig,
  offset: number,
): Promise<{ summaries: OracleRequisitionSummary[]; total: number | null }> {
  const url = new URL(board.requisitionsUrl);
  url.searchParams.set("expand", "all");
  url.searchParams.set("onlyData", "true");
  url.searchParams.set("finder", buildOracleRequisitionsFinder(board, offset));

  const res = await fetchJsonWithTimeout(url.toString());
  if (!res.ok) {
    throw new Error(`Oracle search returned ${res.status} for ${url.toString()}`);
  }

  const payload = (await res.json()) as unknown;
  const summaries = parseOracleSearchResponse(payload, url.toString());
  const total =
    payload && typeof payload === "object" && Array.isArray((payload as OracleSearchResponse).items)
      ? ((payload as OracleSearchResponse).items?.[0]?.TotalJobsCount ?? null)
      : null;

  return { summaries, total };
}

async function enrichOraclePostings(
  board: OracleBoardConfig,
  summaries: OracleRequisitionSummary[],
  sessionUserId: string,
): Promise<OracleEnrichedPosting[]> {
  return mapWithConcurrency(summaries, ORACLE_DETAIL_CONCURRENCY, async (summary) => {
    const requisitionId = summary.Id?.trim();
    if (!requisitionId) {
      return { summary, detail: null };
    }

    try {
      const detail = await fetchOracleDetail(board, requisitionId, sessionUserId);
      return { summary, detail };
    } catch {
      return { summary, detail: null };
    }
  });
}

async function fetchOracleDetail(
  board: OracleBoardConfig,
  requisitionId: string,
  sessionUserId: string,
): Promise<OracleRequisitionDetail | null> {
  const url = new URL(board.detailsUrl);
  url.searchParams.set("expand", "all");
  url.searchParams.set("onlyData", "true");
  url.searchParams.set("finder", buildOracleDetailsFinder(board, requisitionId));

  const res = await fetchJsonWithTimeout(url.toString(), {
    headers: oracleCeHeaders(sessionUserId),
  });

  if (!res.ok) {
    return null;
  }

  const payload = (await res.json()) as unknown;
  return parseOracleDetailResponse(payload, url.toString());
}

export function oracleCeHeaders(sessionUserId: string): HeadersInit {
  return {
    accept: "application/json",
    "content-type": "application/vnd.oracle.adf.resourceitem+json;charset=utf-8",
    "ora-irc-cx-userid": sessionUserId,
    "ora-irc-language": "en",
  };
}

