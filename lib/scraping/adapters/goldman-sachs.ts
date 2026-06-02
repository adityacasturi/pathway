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

/**
 * Goldman Sachs campus recruiting uses Oracle Fusion CE (hdpc.fa.us2.oraclecloud.com).
 * Public listings are surfaced on higher.gs.com; role pages use /roles/{requisitionId}.
 */
export const GOLDMAN_ORACLE_ORIGIN = "https://hdpc.fa.us2.oraclecloud.com";
export const GOLDMAN_DEFAULT_SITE_NUMBER = "CX_3001";
export const GOLDMAN_HIGHER_ORIGIN = "https://higher.gs.com";
export const GOLDMAN_DEFAULT_CAREERS_URL = `${GOLDMAN_HIGHER_ORIGIN}/campus`;
export const GOLDMAN_REQUISITIONS_URL = `${GOLDMAN_ORACLE_ORIGIN}/hcmRestApi/resources/latest/recruitingCEJobRequisitions`;
export const GOLDMAN_DETAILS_URL = `${GOLDMAN_ORACLE_ORIGIN}/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails`;

const GOLDMAN_PAGE_SIZE = 25;
const GOLDMAN_MAX_PAGES = 80;
const GOLDMAN_SEARCH_KEYWORD = "intern";
const GOLDMAN_DETAIL_CONCURRENCY = 4;
const GOLDMAN_REQUEST_DELAY_MS = 400;
const GOLDMAN_FACETS_LIST =
  "LOCATIONS;WORK_LOCATIONS;WORKPLACE_TYPES;TITLES;CATEGORIES;ORGANIZATIONS;POSTING_DATES;FLEX_FIELDS";

/** List titles must look internship-related before we fetch full descriptions. */
const INTERNSHIP_LIST_TITLE_PATTERN =
  /\bintern(?:ship|ships)?\b|\bco-?op\b|\bfellowship\b|\buniversity\b|\bsummer\s+analyst\b|\bnew\s+analyst\b|\bseasonal\/off[- ]?cycle\b/i;

export interface GoldmanBoardConfig {
  siteNumber: string;
  careersOrigin: string;
  requisitionsUrl: string;
  detailsUrl: string;
}

export interface GoldmanRequisitionSummary {
  Id?: string;
  Title?: string;
  PostedDate?: string;
  PrimaryLocation?: string;
  PrimaryLocationCountry?: string;
  JobFamily?: string;
  ShortDescriptionStr?: string;
}

interface GoldmanSearchItem {
  requisitionList?: GoldmanRequisitionSummary[];
  TotalJobsCount?: number;
}

interface GoldmanSearchResponse {
  items?: GoldmanSearchItem[];
}

export interface GoldmanRequisitionDetail {
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

interface GoldmanDetailResponse {
  items?: GoldmanRequisitionDetail[];
}

interface GoldmanEnrichedPosting {
  summary: GoldmanRequisitionSummary;
  detail: GoldmanRequisitionDetail | null;
}

export function createGoldmanSachsAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveGoldmanBoard(source);
  const resolvedSource =
    source.boardToken === board.siteNumber ? source : { ...source, boardToken: board.siteNumber };

  const sessionUserId = randomUUID();

  return {
    source: resolvedSource,
    async fetchRoles() {
      const summaries = await fetchAllGoldmanSummaries(board);
      const candidates = summaries.filter((summary) => isGoldmanListCandidate(summary));
      const enriched = await enrichGoldmanPostings(board, candidates, sessionUserId);
      return parseGoldmanPostings(enriched, resolvedSource, board, summaries.length);
    },
  };
}

export function resolveGoldmanBoard(source: CompanySourceConfig): GoldmanBoardConfig {
  const fromUrl = parseGoldmanCareersUrl(source.sourceUrl);
  const siteNumber = source.boardToken?.trim() || fromUrl?.siteNumber || GOLDMAN_DEFAULT_SITE_NUMBER;
  const careersOrigin = fromUrl?.careersOrigin ?? GOLDMAN_DEFAULT_CAREERS_URL;

  return {
    siteNumber,
    careersOrigin,
    requisitionsUrl: GOLDMAN_REQUISITIONS_URL,
    detailsUrl: GOLDMAN_DETAILS_URL,
  };
}

export function parseGoldmanCareersUrl(
  sourceUrl: string,
): { siteNumber: string; careersOrigin: string } | null {
  const trimmed = sourceUrl.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();

    if (host === "higher.gs.com" || host === "www.goldmansachs.com") {
      return {
        siteNumber: GOLDMAN_DEFAULT_SITE_NUMBER,
        careersOrigin: trimmed.split("?")[0],
      };
    }

    if (host === "hdpc.fa.us2.oraclecloud.com") {
      const segments = parsed.pathname
        .split("/")
        .map((segment) => segment.trim())
        .filter(Boolean);
      const sitesIndex = segments.indexOf("sites");
      const siteNumber =
        sitesIndex >= 0 && segments[sitesIndex + 1] ? segments[sitesIndex + 1] : GOLDMAN_DEFAULT_SITE_NUMBER;
      const localePath = segments.slice(segments.indexOf("CandidateExperience") + 1).join("/");
      const careersOrigin = localePath
        ? `${GOLDMAN_ORACLE_ORIGIN}/hcmUI/CandidateExperience/${localePath}`
        : `${GOLDMAN_ORACLE_ORIGIN}/hcmUI/CandidateExperience/en/sites/${siteNumber}`;
      return { siteNumber, careersOrigin };
    }

    return null;
  } catch {
    return null;
  }
}

export function buildGoldmanRequisitionsFinder(
  board: GoldmanBoardConfig,
  offset: number,
  keyword: string = GOLDMAN_SEARCH_KEYWORD,
): string {
  const params = [
    `siteNumber=${board.siteNumber}`,
    `facetsList=${GOLDMAN_FACETS_LIST}`,
    `limit=${GOLDMAN_PAGE_SIZE}`,
    `offset=${offset}`,
    `keyword=${keyword}`,
  ].join(",");

  return `findReqs;${params}`;
}

export function buildGoldmanDetailsFinder(board: GoldmanBoardConfig, requisitionId: string): string {
  return `ById;Id="${requisitionId}",siteNumber=${board.siteNumber}`;
}

export function buildGoldmanPostingUrl(requisitionId: string): string {
  return `${GOLDMAN_HIGHER_ORIGIN}/roles/${encodeURIComponent(requisitionId)}`;
}

export function buildGoldmanClassificationDescription(
  roleName: string,
  description: string,
  detail: GoldmanRequisitionDetail | null | undefined,
  summary: GoldmanRequisitionSummary,
): string {
  const boost: string[] = [];
  if (/\bsummer\s+analyst\b/i.test(roleName)) {
    boost.push("summer analyst internship program");
  }
  if (/\bseasonal\/off[- ]?cycle\b/i.test(roleName)) {
    boost.push("seasonal off cycle internship program");
  }
  if (/\bsoftware engineer intern\b/i.test(roleName)) {
    boost.push("software engineer internship program");
  }
  const category = detail?.Category?.trim() || "";
  if (/summer analyst|internship|campus/i.test(category)) {
    boost.push(category);
  }
  const jobFamily = summary.JobFamily?.trim() || "";
  if (/engineering/i.test(jobFamily)) {
    boost.push("engineering internship");
  }

  return [...boost, description].filter(Boolean).join("\n");
}

export function formatGoldmanDescription(
  summary: GoldmanRequisitionSummary,
  detail: GoldmanRequisitionDetail | null | undefined,
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

export function formatGoldmanLocations(
  summary: GoldmanRequisitionSummary,
  detail: GoldmanRequisitionDetail | null | undefined,
): string[] {
  const primary = detail?.PrimaryLocation?.trim() || summary.PrimaryLocation?.trim() || "";
  const country =
    detail?.PrimaryLocationCountry?.trim() || summary.PrimaryLocationCountry?.trim() || "";

  return formatPrimaryWithCountryCode(primary, country);
}

export function isGoldmanListCandidate(summary: GoldmanRequisitionSummary): boolean {
  const title = summary.Title?.trim() ?? "";
  if (/\binternal\b|\binternational\b/i.test(title) && !INTERNSHIP_LIST_TITLE_PATTERN.test(title)) {
    return false;
  }

  return INTERNSHIP_LIST_TITLE_PATTERN.test(title);
}

export function parseGoldmanPostings(
  postings: GoldmanEnrichedPosting[],
  source: CompanySourceConfig,
  board: GoldmanBoardConfig,
  fetchedTotal: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const posting of postings) {
    const summary = posting.summary;
    const detail = posting.detail;
    const roleName = (detail?.Title ?? summary.Title)?.trim() || "";
    const requisitionId = (detail?.Id ?? summary.Id)?.trim() || "";
    const description = formatGoldmanDescription(summary, detail);
    const locations = formatGoldmanLocations(summary, detail);
    const postingUrl = requisitionId ? buildGoldmanPostingUrl(requisitionId) : "";

    const classification = classifyForSource(source, {
      title: roleName,
      description: buildGoldmanClassificationDescription(roleName, description, detail, summary),
      employmentType: detail?.JobFunction ?? null,
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
        description: formatGoldmanDescription(summary, detail),
        dates: posted ? atsPublishDate(safeToIsoDate(posted)) : unknownScrapedDates(),
      }),
    );
  }

  return buildRoleParseResult(fetchedTotal, roles, rejected);
}

export function parseGoldmanSearchResponse(payload: unknown, url: string): GoldmanRequisitionSummary[] {
  if (!payload || typeof payload !== "object") {
    throw new Error(`Goldman Sachs search response was not JSON for ${url}`);
  }

  const items = (payload as GoldmanSearchResponse).items;
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const list = items[0]?.requisitionList;
  if (!Array.isArray(list)) {
    throw new Error(`Goldman Sachs search response was not in expected format for ${url}`);
  }

  return list;
}

export function parseGoldmanDetailResponse(payload: unknown, url: string): GoldmanRequisitionDetail | null {
  if (!payload || typeof payload !== "object") {
    throw new Error(`Goldman Sachs detail response was not JSON for ${url}`);
  }

  const items = (payload as GoldmanDetailResponse).items;
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return items[0] ?? null;
}

async function fetchAllGoldmanSummaries(board: GoldmanBoardConfig): Promise<GoldmanRequisitionSummary[]> {
  const summaries: GoldmanRequisitionSummary[] = [];
  let offset = 0;
  let total: number | null = null;

  for (let page = 0; page < GOLDMAN_MAX_PAGES; page++) {
    const batch = await fetchGoldmanSearchPage(board, offset);
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
    if (total === null && batch.summaries.length < GOLDMAN_PAGE_SIZE) {
      break;
    }

    await scraperDelay(GOLDMAN_REQUEST_DELAY_MS);
  }

  return summaries;
}

async function fetchGoldmanSearchPage(
  board: GoldmanBoardConfig,
  offset: number,
): Promise<{ summaries: GoldmanRequisitionSummary[]; total: number | null }> {
  const url = new URL(board.requisitionsUrl);
  url.searchParams.set("expand", "all");
  url.searchParams.set("onlyData", "true");
  url.searchParams.set("finder", buildGoldmanRequisitionsFinder(board, offset));

  const res = await fetchJsonWithTimeout(url.toString());
  if (!res.ok) {
    throw new Error(`Goldman Sachs search returned ${res.status} for ${url.toString()}`);
  }

  const payload = (await res.json()) as unknown;
  const summaries = parseGoldmanSearchResponse(payload, url.toString());
  const total =
    payload && typeof payload === "object" && Array.isArray((payload as GoldmanSearchResponse).items)
      ? ((payload as GoldmanSearchResponse).items?.[0]?.TotalJobsCount ?? null)
      : null;

  return { summaries, total };
}

async function enrichGoldmanPostings(
  board: GoldmanBoardConfig,
  summaries: GoldmanRequisitionSummary[],
  sessionUserId: string,
): Promise<GoldmanEnrichedPosting[]> {
  return mapWithConcurrency(summaries, GOLDMAN_DETAIL_CONCURRENCY, async (summary) => {
    const requisitionId = summary.Id?.trim();
    if (!requisitionId) {
      return { summary, detail: null };
    }

    try {
      const detail = await fetchGoldmanDetail(board, requisitionId, sessionUserId);
      return { summary, detail };
    } catch {
      return { summary, detail: null };
    }
  });
}

async function fetchGoldmanDetail(
  board: GoldmanBoardConfig,
  requisitionId: string,
  sessionUserId: string,
): Promise<GoldmanRequisitionDetail | null> {
  const url = new URL(board.detailsUrl);
  url.searchParams.set("expand", "all");
  url.searchParams.set("onlyData", "true");
  url.searchParams.set("finder", buildGoldmanDetailsFinder(board, requisitionId));

  const res = await fetchJsonWithTimeout(url.toString(), {
    headers: goldmanOracleHeaders(sessionUserId),
  });

  if (!res.ok) {
    return null;
  }

  const payload = (await res.json()) as unknown;
  return parseGoldmanDetailResponse(payload, url.toString());
}

export function goldmanOracleHeaders(sessionUserId: string): HeadersInit {
  return {
    accept: "application/json",
    "content-type": "application/vnd.oracle.adf.resourceitem+json;charset=utf-8",
    "ora-irc-cx-userid": sessionUserId,
    "ora-irc-language": "en",
  };
}

