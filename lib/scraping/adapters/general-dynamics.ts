import { gzipSync } from "node:zlib";

import { atsPublishDate } from "../posted-date.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import {
  fetchJsonWithTimeout,
  isHttpUrl,
  resolveBoardToken,
  safeToIsoDate,
  scraperDelay,
} from "./shared.ts";

/**
 * General Dynamics corporate careers (gd.com) use Sitecore CareerSearch with gzip+base64
 * request payloads and per-page API auth headers. Workday myworkdayjobs hosts exist for
 * subsidiaries but not as a single parent-company board.
 */
export const GENERAL_DYNAMICS_CAREERS_ORIGIN = "https://www.gd.com";
export const GENERAL_DYNAMICS_JOB_SEARCH_URL = `${GENERAL_DYNAMICS_CAREERS_ORIGIN}/careers/job-search`;
export const GENERAL_DYNAMICS_CAREER_SEARCH_API = `${GENERAL_DYNAMICS_CAREERS_ORIGIN}/API/Careers/CareerSearch`;
export const GENERAL_DYNAMICS_DEFAULT_SEARCH_KEYWORD = "intern";

const GENERAL_DYNAMICS_SEARCH_KEYWORDS = [
  "intern",
  "internship",
  "co-op",
  "university",
] as const;

const GENERAL_DYNAMICS_PAGE_SIZE = 100;
const GENERAL_DYNAMICS_MAX_PAGES_PER_KEYWORD = 20;
const GENERAL_DYNAMICS_DETAIL_CONCURRENCY = 6;
const GENERAL_DYNAMICS_REQUEST_DELAY_MS = 150;

const INTERNSHIP_LIST_TITLE_PATTERN =
  /\bintern(?:ship|ships)?\b|\bco-?op\b|\bfellowship\b|\buniversity\b|\bstudent\b/i;

export interface GeneralDynamicsBoardConfig {
  careersOrigin: string;
  jobSearchUrl: string;
  searchKeywords: string[];
}

export interface GeneralDynamicsSearchResult {
  Title?: string;
  Category?: string | null;
  Company?: string | null;
  Clearance?: string | null;
  Date?: string | null;
  FormattedDate?: string | null;
  ReferenceCode?: string | null;
  LocationNames?: string[];
  Locations?: Array<{ Name?: string; Country?: string; State?: string }>;
  Link?: { Url?: string };
  EmploymentTypes?: string[];
}

export interface GeneralDynamicsCareerSearchResponse {
  IsLogicError?: boolean;
  Results?: GeneralDynamicsSearchResult[];
  Page?: number;
  PageCount?: number;
  PageSize?: number;
}

export interface GeneralDynamicsListing {
  title: string;
  postingUrl: string;
  location: string | null;
  category: string | null;
  companyUnit: string | null;
  datePosted: string | null;
  description?: string | null;
}

export interface GeneralDynamicsApiAuth {
  nonce: string;
  signature: string;
  timestamp: string;
}

export function createGeneralDynamicsAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveGeneralDynamicsBoard(source);
  const resolvedSource =
    source.sourceUrl === board.jobSearchUrl ? source : { ...source, sourceUrl: board.jobSearchUrl };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const listings = await fetchAllGeneralDynamicsListings(board);
      const candidates = listings.filter(isGeneralDynamicsListCandidate);
      const enriched = await enrichGeneralDynamicsListings(candidates);
      return parseGeneralDynamicsJobs(enriched, resolvedSource, listings.length);
    },
  };
}

export function resolveGeneralDynamicsBoard(source: CompanySourceConfig): GeneralDynamicsBoardConfig {
  const careersOrigin = parseGeneralDynamicsCareersOrigin(source.sourceUrl) ?? GENERAL_DYNAMICS_CAREERS_ORIGIN;
  const fromToken = resolveBoardToken(source, parseGeneralDynamicsSearchKeywordFromUrl);
  const searchKeywords = fromToken
    ? [fromToken, ...GENERAL_DYNAMICS_SEARCH_KEYWORDS.filter((keyword) => keyword !== fromToken)]
    : [...GENERAL_DYNAMICS_SEARCH_KEYWORDS];

  return {
    careersOrigin,
    jobSearchUrl: `${careersOrigin.replace(/\/$/, "")}/careers/job-search`,
    searchKeywords,
  };
}

export function encodeGeneralDynamicsCareerSearchRequest(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload);
  return gzipSync(Buffer.from(json, "utf8")).toString("base64");
}

export function buildGeneralDynamicsCareerSearchPayload(
  keyword: string,
  page: number,
  pageSize = GENERAL_DYNAMICS_PAGE_SIZE,
): Record<string, unknown> {
  return {
    address: [],
    facets: [
      { name: "career_page_size", value: String(pageSize) },
      { name: "career_radius", value: "50 miles" },
    ],
    page,
    what: keyword,
  };
}

export function parseGeneralDynamicsSearchResponse(
  response: GeneralDynamicsCareerSearchResponse,
  careersOrigin: string,
): GeneralDynamicsListing[] {
  const listings: GeneralDynamicsListing[] = [];

  for (const result of response.Results ?? []) {
    const title = result.Title?.trim();
    const relativeUrl = result.Link?.Url?.trim();
    if (!title || !relativeUrl) {
      continue;
    }

    const postingUrl = buildGeneralDynamicsPostingUrl(careersOrigin, relativeUrl);
    if (!postingUrl) {
      continue;
    }

    const location =
      result.LocationNames?.[0]?.trim() ??
      result.Locations?.[0]?.Name?.trim() ??
      null;

    listings.push({
      title,
      postingUrl,
      location,
      category: result.Category?.trim() || null,
      companyUnit: result.Company?.trim() || null,
      datePosted: safeToIsoDate(result.Date ?? result.FormattedDate),
    });
  }

  return dedupeListingsByUrl(listings);
}

export function parseGeneralDynamicsJobDetailFields(html: string): {
  title: string | null;
  location: string | null;
  category: string | null;
  companyUnit: string | null;
  description: string;
  datePosted: string | null;
  unavailable: boolean;
} {
  if (/Job No Longer Available/i.test(html)) {
    return {
      title: null,
      location: null,
      category: null,
      companyUnit: null,
      description: "",
      datePosted: null,
      unavailable: true,
    };
  }

  const title =
    html.match(/<h1 class="career-detail-title featured-title">([^<]+)/i)?.[1]?.trim() ?? null;

  const descriptionBlock = html.match(/<div class="career-detail-description">([\s\S]*?)<\/div>/i)?.[1];
  const description = descriptionBlock ? htmlToPlainText(descriptionBlock) : "";

  const location =
    html.match(/<dt>\s*Location\s*<\/dt>\s*<dd[^>]*>([^<]+)/i)?.[1]?.trim() ??
    html.match(/US-[A-Z]{2}-[^<]+/i)?.[0]?.trim() ??
    null;

  const category = html.match(/<dt>\s*Category\s*<\/dt>\s*<dd[^>]*>([^<]+)/i)?.[1]?.trim() ?? null;
  const companyUnit =
    html.match(/<dt>\s*Business Unit\s*<\/dt>\s*<dd[^>]*>([^<]+)/i)?.[1]?.trim() ?? null;

  const datePosted =
    html.match(/<dt>\s*Date Posted\s*<\/dt>\s*<dd[^>]*>([^<]+)/i)?.[1]?.trim() ?? null;

  return {
    title,
    location,
    category,
    companyUnit,
    description,
    datePosted: safeToIsoDate(datePosted),
    unavailable: false,
  };
}

export function parseGeneralDynamicsJobs(
  listings: GeneralDynamicsListing[],
  source: CompanySourceConfig,
  fetchedTotal: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const listing of listings) {
    const roleName = listing.title.trim();
    const postingUrl = listing.postingUrl.trim();
    const description = buildGeneralDynamicsClassificationDescription(listing);
    const locations = listing.location ? [listing.location] : [];
    const departments = [listing.category, listing.companyUnit].filter(
      (value): value is string => Boolean(value),
    );

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
        description: buildGeneralDynamicsClassificationDescription(listing),
        dates: atsPublishDate(safeToIsoDate(listing.datePosted)),
      }),
    );
  }

  return buildRoleParseResult(fetchedTotal, roles, rejected);
}

export function isGeneralDynamicsListCandidate(listing: GeneralDynamicsListing): boolean {
  const haystack = [listing.title, listing.category, listing.companyUnit, listing.location]
    .filter(Boolean)
    .join(" ");
  return INTERNSHIP_LIST_TITLE_PATTERN.test(haystack);
}

export function buildGeneralDynamicsPostingUrl(
  careersOrigin: string,
  relativeUrl: string,
): string | null {
  const trimmed = relativeUrl.trim();
  if (!trimmed.startsWith("/careers/") || !trimmed.includes("-opportunity")) {
    return null;
  }
  return `${careersOrigin.replace(/\/$/, "")}${trimmed}`;
}

export function parseGeneralDynamicsApiAuthFromHtml(html: string): GeneralDynamicsApiAuth | null {
  const match = html.match(
    /data-nonce="([^"]+)"\s+data-signature="([^"]+)"\s+data-timestamp="([^"]+)"/i,
  );
  if (!match) {
    return null;
  }
  return {
    nonce: match[1] ?? "",
    signature: match[2] ?? "",
    timestamp: match[3] ?? "",
  };
}

async function fetchAllGeneralDynamicsListings(
  board: GeneralDynamicsBoardConfig,
): Promise<GeneralDynamicsListing[]> {
  const all: GeneralDynamicsListing[] = [];

  for (const keyword of board.searchKeywords) {
    let pageCount = 1;

    for (let page = 0; page < GENERAL_DYNAMICS_MAX_PAGES_PER_KEYWORD; page += 1) {
      if (page >= pageCount) {
        break;
      }

      const { response } = await fetchGeneralDynamicsCareerSearchPage(board, keyword, page);
      if (response.IsLogicError) {
        throw new Error(`General Dynamics CareerSearch logic error for keyword ${keyword}`);
      }

      pageCount = response.PageCount ?? page + 1;
      const batch = parseGeneralDynamicsSearchResponse(response, board.careersOrigin);
      all.push(...batch);

      if (batch.length < GENERAL_DYNAMICS_PAGE_SIZE) {
        break;
      }

      await scraperDelay(GENERAL_DYNAMICS_REQUEST_DELAY_MS);
    }
  }

  return dedupeListingsByUrl(all);
}

async function fetchGeneralDynamicsCareerSearchPage(
  board: GeneralDynamicsBoardConfig,
  keyword: string,
  page: number,
): Promise<{ response: GeneralDynamicsCareerSearchResponse; auth: GeneralDynamicsApiAuth }> {
  const auth = await fetchGeneralDynamicsApiAuth(board.jobSearchUrl);
  const payload = buildGeneralDynamicsCareerSearchPayload(keyword, page);
  const request = encodeGeneralDynamicsCareerSearchRequest(payload);
  const url = `${GENERAL_DYNAMICS_CAREER_SEARCH_API}?${new URLSearchParams({ request }).toString()}`;

  const res = await fetchJsonWithTimeout(url, {
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      referer: board.jobSearchUrl,
      "api-auth-nonce": auth.nonce,
      "api-auth-signature": auth.signature,
      "api-auth-timestamp": auth.timestamp,
    },
  });

  if (!res.ok) {
    throw new Error(`General Dynamics CareerSearch returned ${res.status} for ${keyword} page ${page}`);
  }

  const response = (await res.json()) as GeneralDynamicsCareerSearchResponse;
  return { response, auth };
}

async function fetchGeneralDynamicsApiAuth(jobSearchUrl: string): Promise<GeneralDynamicsApiAuth> {
  const res = await fetchJsonWithTimeout(jobSearchUrl, {
    headers: { accept: "text/html,application/xhtml+xml" },
  });
  if (!res.ok) {
    throw new Error(`General Dynamics job search page returned ${res.status}`);
  }
  const html = await res.text();
  const auth = parseGeneralDynamicsApiAuthFromHtml(html);
  if (!auth?.nonce || !auth.signature || !auth.timestamp) {
    throw new Error("General Dynamics job search page missing API auth headers");
  }
  return auth;
}

async function enrichGeneralDynamicsListings(
  listings: GeneralDynamicsListing[],
): Promise<GeneralDynamicsListing[]> {
  if (listings.length === 0) {
    return listings;
  }

  const details = new Map<string, ReturnType<typeof parseGeneralDynamicsJobDetailFields>>();
  let index = 0;

  async function worker(): Promise<void> {
    while (index < listings.length) {
      const current = listings[index];
      index += 1;
      if (!current) {
        continue;
      }
      try {
        const html = await fetchGeneralDynamicsHtml(current.postingUrl);
        details.set(current.postingUrl, parseGeneralDynamicsJobDetailFields(html));
      } catch {
        details.set(current.postingUrl, {
          title: null,
          location: null,
          category: null,
          companyUnit: null,
          description: "",
          datePosted: null,
          unavailable: true,
        });
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(GENERAL_DYNAMICS_DETAIL_CONCURRENCY, listings.length) },
      () => worker(),
    ),
  );

  const enriched: GeneralDynamicsListing[] = [];
  for (const listing of listings) {
    const detail = details.get(listing.postingUrl);
    if (!detail || detail.unavailable) {
      continue;
    }
    enriched.push({
      ...listing,
      title: detail.title ?? listing.title,
      location: detail.location ?? listing.location,
      category: detail.category ?? listing.category,
      companyUnit: detail.companyUnit ?? listing.companyUnit,
      description: detail.description || listing.description,
      datePosted: detail.datePosted ?? listing.datePosted,
    });
  }
  return enriched;
}

async function fetchGeneralDynamicsHtml(url: string): Promise<string> {
  const res = await fetchJsonWithTimeout(url, {
    headers: { accept: "text/html,application/xhtml+xml" },
  });
  if (!res.ok) {
    throw new Error(`General Dynamics careers returned ${res.status} for ${url}`);
  }
  return res.text();
}

function parseGeneralDynamicsSearchKeywordFromUrl(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    if (!parsed.hostname.toLowerCase().endsWith("gd.com")) {
      return null;
    }
    const keyword = parsed.searchParams.get("what")?.trim();
    return keyword || null;
  } catch {
    return null;
  }
}

function parseGeneralDynamicsCareersOrigin(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    if (!parsed.hostname.toLowerCase().endsWith("gd.com")) {
      return null;
    }
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return null;
  }
}

function buildGeneralDynamicsClassificationDescription(listing: GeneralDynamicsListing): string {
  const boost: string[] = [];
  if (listing.category && /intern|student|university|co op/i.test(listing.category)) {
    boost.push(listing.category);
  }
  if (/\bintern(?:ship)?\b/i.test(listing.title)) {
    boost.push("internship program");
  }
  if (listing.companyUnit) {
    boost.push(listing.companyUnit);
  }

  return [...boost, listing.description ?? ""].filter(Boolean).join("\n");
}

function dedupeListingsByUrl(listings: GeneralDynamicsListing[]): GeneralDynamicsListing[] {
  const byUrl = new Map<string, GeneralDynamicsListing>();
  for (const listing of listings) {
    byUrl.set(listing.postingUrl, listing);
  }
  return Array.from(byUrl.values());
}

