import { classifyForSource } from "../adapter-parse.ts";
import { isUsCountryCode, normalizeCountryCode } from "../location.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { relativeParseDate } from "../posted-date.ts";
import { fetchJsonWithTimeout, isHttpUrl, safeToIsoDate } from "./shared.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";
import { mapWithConcurrency } from "../scrape-concurrency.ts";

const WORKDAY_PAGE_SIZE = 20;
const WORKDAY_MAX_PAGES = 40;
const WORKDAY_SEARCH_TEXT = "intern";
const WORKDAY_DETAIL_CONCURRENCY = 6;
/** When Workday only exposes "30+ Days Ago", bucket to this many days before reference for sorting. */
const WORKDAY_STALE_POSTING_DAYS = 45;

/** List titles must look internship-related before we fetch full descriptions. */
const MYWORKDAY_HOST = /^([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com$/i;
const LOCALE_SEGMENT = /^[a-z]{2}-[A-Z]{2}$/;

export interface WorkdayBoardConfig {
  tenant: string;
  wdInstance: string;
  site: string;
  locale: string;
  careersOrigin: string;
  cxsJobsUrl: string;
  cxsOrigin: string;
  /** Optional CXS facet id for United States (append `?usCountryFacet=` to careers URL). */
  usCountryFacetId: string | null;
}

export interface WorkdayJobPostingSummary {
  title?: string;
  externalPath?: string;
  locationsText?: string;
  postedOn?: string;
  bulletFields?: string[];
}

interface WorkdayJobsListResponse {
  total?: number;
  jobPostings?: WorkdayJobPostingSummary[];
}

interface WorkdayCountryRef {
  descriptor?: string;
  alpha2Code?: string;
}

interface WorkdayLocationRef {
  descriptor?: string;
  country?: WorkdayCountryRef;
}

export interface WorkdayJobPostingDetail {
  title?: string;
  jobDescription?: string;
  location?: string;
  country?: WorkdayCountryRef;
  jobRequisitionLocation?: WorkdayLocationRef;
  timeType?: string;
  posted?: boolean;
  postedOn?: string;
}

interface WorkdayJobDetailResponse {
  jobPostingInfo?: WorkdayJobPostingDetail;
}

export interface WorkdayEnrichedPosting {
  summary: WorkdayJobPostingSummary;
  detail: WorkdayJobPostingDetail | null;
}

export function createWorkdayAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = parseWorkdayCareersUrl(source.sourceUrl, source.boardToken);
  const resolvedSource =
    source.boardToken === board.site ? source : { ...source, boardToken: board.site };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const summaries = await fetchAllWorkdaySummaries(board);
      const candidates = summaries.filter((summary) =>
        INTERNSHIP_LIST_TITLE_PATTERN.test(summary.title?.trim() ?? ""),
      );

      const enriched = await enrichWorkdayPostings(board, candidates);
      return parseWorkdayPostings(enriched, resolvedSource, board, summaries.length);
    },
  };
}

export function parseWorkdayCareersUrl(
  sourceUrl: string,
  boardToken?: string | null,
): WorkdayBoardConfig {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    throw new Error(`Invalid Workday careers URL: ${sourceUrl}`);
  }

  const hostMatch = parsed.hostname.toLowerCase().match(MYWORKDAY_HOST);
  if (!hostMatch) {
    throw new Error(`Not a myworkdayjobs.com careers host: ${parsed.hostname}`);
  }

  const tenant = hostMatch[1];
  const wdInstance = hostMatch[2];
  const segments = parsed.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  let locale = "en-US";
  let siteFromPath = "";

  if (segments[0] && LOCALE_SEGMENT.test(segments[0])) {
    locale = segments[0];
    siteFromPath = segments[1] ?? "";
  } else {
    siteFromPath = segments[0] ?? "";
  }

  const site = (boardToken?.trim() || siteFromPath || "").trim();
  if (!site) {
    throw new Error(`Unable to resolve Workday site for ${sourceUrl}`);
  }

  const careersOrigin = `${parsed.protocol}//${parsed.hostname}/${locale}/${site}`.replace(/\/$/, "");
  const cxsOrigin = `${parsed.protocol}//${parsed.hostname}`;
  const cxsJobsUrl = `${cxsOrigin}/wday/cxs/${tenant}/${site}/jobs`;
  const usCountryFacetId = parsed.searchParams.get("usCountryFacet")?.trim() || null;

  return {
    tenant,
    wdInstance,
    site,
    locale,
    careersOrigin,
    cxsJobsUrl,
    cxsOrigin,
    usCountryFacetId,
  };
}

export function workdayAppliedFacets(board: WorkdayBoardConfig): Record<string, string[]> {
  if (!board.usCountryFacetId) {
    return {};
  }
  return { locationCountry: [board.usCountryFacetId] };
}

export function buildWorkdayPostingUrl(
  board: WorkdayBoardConfig,
  externalPath: string,
): string | null {
  const normalizedPath = externalPath.trim();
  if (!normalizedPath.startsWith("/job/")) {
    return null;
  }
  return `${board.careersOrigin}${normalizedPath}`;
}

export function buildWorkdayDetailUrl(board: WorkdayBoardConfig, externalPath: string): string | null {
  const normalizedPath = externalPath.trim();
  if (!normalizedPath.startsWith("/job/")) {
    return null;
  }
  return `${board.cxsOrigin}/wday/cxs/${board.tenant}/${board.site}${normalizedPath}`;
}

export function parseWorkdayPostedOn(
  value: string | null | undefined,
  referenceDate: Date = new Date(),
): string | null {
  if (!value?.trim()) {
    return null;
  }

  const normalized = value.trim();
  let daysAgo: number | null = null;

  if (/^posted\s+today$/i.test(normalized)) {
    daysAgo = 0;
  } else if (/^posted\s+yesterday$/i.test(normalized)) {
    daysAgo = 1;
  } else if (/^posted\s+30\+\s+days?\s+ago$/i.test(normalized)) {
    daysAgo = WORKDAY_STALE_POSTING_DAYS;
  } else {
    const dayMatch = normalized.match(/^posted\s+(\d+)\s+days?\s+ago$/i);
    if (dayMatch) {
      daysAgo = Number.parseInt(dayMatch[1], 10);
    } else {
      const weekMatch = normalized.match(/^posted\s+(\d+)\s+weeks?\s+ago$/i);
      if (weekMatch) {
        daysAgo = Number.parseInt(weekMatch[1], 10) * 7;
      }
    }
  }

  if (daysAgo === null || !Number.isFinite(daysAgo) || daysAgo < 0) {
    return null;
  }

  const posted = startOfUtcDay(referenceDate);
  posted.setUTCDate(posted.getUTCDate() - daysAgo);
  return safeToIsoDate(posted);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function parseWorkdayPostings(
  postings: WorkdayEnrichedPosting[],
  source: CompanySourceConfig,
  board: WorkdayBoardConfig,
  fetchedTotal: number,
  referenceDate: Date = new Date(),
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const posting of postings) {
    const summary = posting.summary;
    const detail = posting.detail;
    const roleName = (detail?.title ?? summary.title)?.trim() || "";
    const postingUrl = buildWorkdayPostingUrl(board, summary.externalPath ?? "");
    const description = detail?.jobDescription ?? "";
    const locations = collectWorkdayLocationSegments(detail, summary);

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      commitment: detail?.timeType ?? null,
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

    const postedOnRaw = detail?.postedOn ?? summary.postedOn ?? null;
    const published = parseWorkdayPostedOn(postedOnRaw, referenceDate);
    roles.push(
      buildScrapedRole({
        postingUrl,
        roleName,
        companyName: source.companyName,
        companySlug: source.companySlug,
        classification,
        description,
        dates: relativeParseDate(published, postedOnRaw),
        seasonHints: { commitment: detail?.timeType ?? null },
      }),
    );
  }

  return buildRoleParseResult(fetchedTotal, roles, rejected);
}

export async function fetchWorkdayJobSummaries(
  board: WorkdayBoardConfig,
  searchText: string,
): Promise<WorkdayJobPostingSummary[]> {
  const summaries: WorkdayJobPostingSummary[] = [];
  let offset = 0;
  let total: number | null = null;

  for (let page = 0; page < WORKDAY_MAX_PAGES; page++) {
    const payload = await postWorkdayJobs(board, {
      appliedFacets: workdayAppliedFacets(board),
      limit: WORKDAY_PAGE_SIZE,
      offset,
      searchText,
    });

    const batch = payload.jobPostings ?? [];
    if (typeof payload.total === "number" && payload.total > 0) {
      total = payload.total;
    }

    summaries.push(...batch);

    if (batch.length === 0) {
      break;
    }

    offset += batch.length;
    if (total !== null && offset >= total) {
      break;
    }
    if (total === null && batch.length < WORKDAY_PAGE_SIZE) {
      break;
    }
  }

  return summaries;
}

async function fetchAllWorkdaySummaries(board: WorkdayBoardConfig): Promise<WorkdayJobPostingSummary[]> {
  return fetchWorkdayJobSummaries(board, WORKDAY_SEARCH_TEXT);
}

function workdayCxsHeaders(board: WorkdayBoardConfig): HeadersInit {
  return {
    Accept: "application/json",
    "Accept-Language": "en-US",
    "Content-Type": "application/json",
    Referer: `${board.careersOrigin}/`,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  };
}

async function postWorkdayJobs(
  board: WorkdayBoardConfig,
  body: Record<string, unknown>,
): Promise<WorkdayJobsListResponse> {
  const res = await fetchJsonWithTimeout(board.cxsJobsUrl, {
    method: "POST",
    headers: workdayCxsHeaders(board),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Workday returned ${res.status} for ${board.cxsJobsUrl}`);
  }

  const payload = (await res.json()) as unknown;
  if (!payload || typeof payload !== "object") {
    throw new Error(`Workday response was not JSON for ${board.cxsJobsUrl}`);
  }

  return payload as WorkdayJobsListResponse;
}

export async function enrichWorkdayPostings(
  board: WorkdayBoardConfig,
  summaries: WorkdayJobPostingSummary[],
): Promise<WorkdayEnrichedPosting[]> {
  return mapWithConcurrency(summaries, WORKDAY_DETAIL_CONCURRENCY, async (summary) => {
    const detailUrl = buildWorkdayDetailUrl(board, summary.externalPath ?? "");
    if (!detailUrl) {
      return { summary, detail: null };
    }

    try {
      const res = await fetchJsonWithTimeout(detailUrl);
      if (!res.ok) {
        return { summary, detail: null };
      }
      const payload = (await res.json()) as WorkdayJobDetailResponse;
      return { summary, detail: payload.jobPostingInfo ?? null };
    } catch {
      return { summary, detail: null };
    }
  });
}

/** Location segments from CXS detail, list row, and bullet fields. */
export function collectWorkdayLocationSegments(
  detail: WorkdayJobPostingDetail | null | undefined,
  summary: WorkdayJobPostingSummary,
): string[] {
  const segments: string[] = [];
  const primary = formatWorkdayLocation(detail, summary.locationsText);
  if (primary) {
    segments.push(primary);
  }

  for (const bullet of summary.bulletFields ?? []) {
    const trimmed = bullet.trim();
    if (!trimmed || segments.includes(trimmed)) {
      continue;
    }
    if (/^locations?:/i.test(trimmed)) {
      const value = trimmed.replace(/^locations?:\s*/i, "").trim();
      if (value) {
        segments.push(value);
      }
      continue;
    }
    if (/,/.test(trimmed) && /\b(US|USA|United States|[A-Z]{2})\b/i.test(trimmed)) {
      segments.push(trimmed);
    }
  }

  return segments;
}

export function formatWorkdayLocation(
  detail: WorkdayJobPostingDetail | null | undefined,
  summaryLocation: string | undefined,
): string | null {
  const alpha2 =
    detail?.jobRequisitionLocation?.country?.alpha2Code?.trim() ||
    detail?.country?.alpha2Code?.trim() ||
    null;
  const normalizedAlpha2 = normalizeCountryCode(alpha2);
  if (normalizedAlpha2 && !isUsCountryCode(normalizedAlpha2)) {
    return null;
  }

  const primary =
    detail?.location?.trim() ||
    detail?.jobRequisitionLocation?.descriptor?.trim() ||
    summaryLocation?.trim() ||
    "";

  if (!primary) {
    return null;
  }

  const countryLabel =
    detail?.country?.descriptor?.trim() ||
    detail?.jobRequisitionLocation?.country?.descriptor?.trim() ||
    alpha2 ||
    "";

  if (!countryLabel) {
    return primary;
  }

  if (primary.toLowerCase().includes(countryLabel.toLowerCase())) {
    return primary;
  }

  if (countryLabel.length === 2) {
    return `${primary}, ${countryLabel.toUpperCase()}`;
  }

  return `${primary}, ${countryLabel}`;
}

