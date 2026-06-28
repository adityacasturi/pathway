import { classifyForSource } from "../adapter-parse.ts";
import { decodeBrassRingEntities, decodeHtmlEntities, stripHtml } from "../html-utils.ts";
import { mergeCookieHeaders } from "../http-utils.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";
import { htmlToPlainText } from "../plain-text.ts";
import { inferSeason } from "../season.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, fetchWithTimeout, isHttpUrl, resolveBoardToken } from "./shared.ts";

/**
 * Lockheed Martin careers moved to Radancy TalentBrew (lockheedmartinjobs.com).
 * Legacy BrassRing (sjobs.brassring.com) remains for older source_url rows.
 */
export const LOCKHEED_MARTIN_JOBS_ORIGIN = "https://www.lockheedmartinjobs.com";
export const LOCKHEED_MARTIN_DEFAULT_SEARCH_KEYWORD = "intern";
export const LOCKHEED_MARTIN_DEFAULT_JOBS_SEARCH_URL = `${LOCKHEED_MARTIN_JOBS_ORIGIN}/search-jobs?k=intern&l=&listFilterMode=1`;
export const LOCKHEED_MARTIN_BRASSRING_ORIGIN = "https://sjobs.brassring.com";
export const LOCKHEED_MARTIN_DEFAULT_PARTNER_ID = "25037";
export const LOCKHEED_MARTIN_DEFAULT_SITE_ID = "5010";
export const LOCKHEED_MARTIN_CAREERS_URL = `${LOCKHEED_MARTIN_BRASSRING_ORIGIN}/TGnewUI/Search/Home/Home?partnerid=${LOCKHEED_MARTIN_DEFAULT_PARTNER_ID}&siteid=${LOCKHEED_MARTIN_DEFAULT_SITE_ID}`;

const LOCKHEED_JOBS_PAGE_SIZE = 15;
const LOCKHEED_JOBS_MAX_PAGES = 40;
const LOCKHEED_JOBS_DETAIL_CONCURRENCY = 6;

const LOCKHEED_JOBS_LISTING_PATTERN =
  /<a href="(\/job\/[^"]+)"[^>]*>((?:(?!<\/a>)[\s\S])*?)<span class="job-title">([^<]+)<\/span>(?:(?!<\/a>)[\s\S])*?<span class="job-location[^"]*">([^<]*)<\/span>/gi;

export type LockheedMartinPlatform = "jobs_portal" | "brassring";

export interface LockheedJobsBoardConfig {
  careersOrigin: string;
  searchKeyword: string;
  searchUrl: string;
}

export interface LockheedJobsListing {
  title: string;
  postingUrl: string;
  location: string | null;
  category: string | null;
  description?: string | null;
}

const MATCHED_JOBS_URL = `${LOCKHEED_MARTIN_BRASSRING_ORIGIN}/TgNewUI/Search/Ajax/MatchedJobs`;
const JOB_DETAILS_URL = `${LOCKHEED_MARTIN_BRASSRING_ORIGIN}/TgNewUI/Search/Ajax/JobDetails`;
const SHOW_MORE_JOBS_URL = `${LOCKHEED_MARTIN_BRASSRING_ORIGIN}/TgNewUI/Search/Ajax/ProcessSortAndShowMoreJobs`;

const SEARCH_KEYWORDS = [
  "Intern Tech",
  "software intern",
  "engineering intern",
  "computer science intern",
  "summer intern",
  "co-op",
  "internship",
] as const;

const MAX_PAGES_PER_KEYWORD = 8;
const DETAIL_CONCURRENCY = 6;
/** List rows that may be internships before we fetch JobDetails. */
const LIST_CANDIDATE_PATTERN =
  /\bintern(?:ship|ships)?\b|\bco-?op\b|\breturnship\b|\buniversity\b|\bstudent\b/i;

const RFT_PATTERN =
  /name="__RequestVerificationToken"[^>]*value="([^"]+)"/i;
const SESSION_PATTERN = /id="CookieValue"[^>]*value="([^"]+)"/i;

export interface LockheedMartinBoardConfig {
  partnerId: string;
  siteId: string;
  careersHomeUrl: string;
}

export interface BrassRingJobSummary {
  reqId: string;
  title: string;
  state: string | null;
  businessArea: string | null;
  qualificationsSnippet: string | null;
  jobCode: string | null;
  program: string | null;
  lastUpdated: string | null;
}

export interface BrassRingJobDetail extends BrassRingJobSummary {
  description: string | null;
  basicQualifications: string | null;
  city: string | null;
  cityState: string | null;
  jobClass: string | null;
  employmentType: string | null;
}

interface BrassRingQuestion {
  QuestionName?: string;
  Value?: string;
  AnswerValue?: string;
  VerityZone?: string;
}

interface BrassRingMatchedJobsResponse {
  JobsCount?: number;
  Jobs?: { Job?: BrassRingJobBlock | BrassRingJobBlock[] };
}

interface BrassRingJobBlock {
  Questions?: BrassRingQuestion[];
}

interface BrassRingJobDetailsResponse {
  ServiceResponse?: {
    Jobdetails?: {
      JobDetailQuestions?: BrassRingQuestion[];
    };
  };
}

export interface BrassRingSession {
  board: LockheedMartinBoardConfig;
  cookieHeader: string;
  requestVerificationToken: string;
  encryptedSessionValue: string;
}

export function createLockheedMartinAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const platform = resolveLockheedMartinPlatform(source);

  if (platform === "jobs_portal") {
    const board = resolveLockheedJobsBoard(source);
    const resolvedSource =
      source.boardToken === board.searchKeyword && source.sourceUrl === board.searchUrl
        ? source
        : { ...source, boardToken: board.searchKeyword, sourceUrl: board.searchUrl };

    return {
      source: resolvedSource,
      async fetchRoles() {
        const listings = await fetchAllLockheedJobsListings(board);
        const enriched = await enrichLockheedJobsListings(listings, board);
        return parseLockheedJobsListings(enriched, resolvedSource);
      },
    };
  }

  const board = resolveLockheedMartinBoard(source);
  const boardToken = `${board.partnerId}:${board.siteId}`;
  const resolvedSource =
    source.boardToken === boardToken && source.sourceUrl === board.careersHomeUrl
      ? source
      : { ...source, boardToken, sourceUrl: board.careersHomeUrl };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const session = await fetchBrassRingSession(board);
      const summaries = await fetchAllLockheedSummaries(session);
      const candidates = summaries.filter(isLockheedListCandidate);
      const details = await enrichLockheedSummaries(session, candidates);
      return parseLockheedMartinJobs(details, resolvedSource, summaries.length);
    },
  };
}

export function resolveLockheedMartinPlatform(source: CompanySourceConfig): LockheedMartinPlatform {
  if (parseLockheedJobsOrigin(source.sourceUrl)) {
    return "jobs_portal";
  }
  if (parseLockheedBoardFromUrl(source.sourceUrl)) {
    return "brassring";
  }
  return "jobs_portal";
}

export function resolveLockheedJobsBoard(source: CompanySourceConfig): LockheedJobsBoardConfig {
  const searchKeyword =
    resolveBoardToken(source, parseLockheedJobsSearchKeywordFromUrl) ||
    LOCKHEED_MARTIN_DEFAULT_SEARCH_KEYWORD;
  const searchUrl = normalizeLockheedJobsSearchUrl(source.sourceUrl, searchKeyword);

  return {
    careersOrigin: LOCKHEED_MARTIN_JOBS_ORIGIN,
    searchKeyword,
    searchUrl,
  };
}

export function parseLockheedJobsSearchHtml(html: string, careersOrigin: string): LockheedJobsListing[] {
  const listings: LockheedJobsListing[] = [];

  for (const match of html.matchAll(LOCKHEED_JOBS_LISTING_PATTERN)) {
    const relativePath = decodeHtmlEntities(match[1]?.trim() ?? "");
    const title = decodeHtmlEntities(stripHtml(match[3] ?? ""));
    const location = decodeHtmlEntities(stripHtml(match[4] ?? "")) || null;
    if (!relativePath || !title || !isLockheedJobsJobPath(relativePath)) {
      continue;
    }

    const postingUrl = buildLockheedJobsPostingUrl(careersOrigin, relativePath);
    if (!postingUrl) {
      continue;
    }

    listings.push({
      title,
      postingUrl,
      location: normalizeLockheedJobsListLocation(location),
      category: null,
    });
  }

  return dedupeLockheedJobsByUrl(listings);
}

export function parseLockheedJobsDetailFields(html: string): {
  category: string | null;
  location: string | null;
  description: string;
} {
  const category =
    html.match(/<span class="job-category[^"]*"[^>]*>\s*<b>Category<\/b>\s*([^<]+)/i)?.[1]?.trim() ??
    null;

  const location =
    html.match(/<p class="ajd_header__location">([^<]+)/i)?.[1]?.trim() ??
    html.match(/<span class="job-location-jd[^"]*"[^>]*>[\s\S]*?<b>Location<\/b>\s*([^<]+)/i)?.[1]?.trim() ??
    null;

  const descriptionBlock =
    html.match(/<div class="ats-description">([\s\S]*?)<div class="qualifications"/i)?.[1] ??
    html.match(/<div class="ats-description">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i)?.[1];
  const description = descriptionBlock ? htmlToPlainText(descriptionBlock) : "";

  return { category, location, description };
}

export function parseLockheedJobsListings(
  listings: LockheedJobsListing[],
  source: CompanySourceConfig,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const listing of listings) {
    const roleName = listing.title.trim();
    const postingUrl = listing.postingUrl.trim();
    const description = buildLockheedJobsClassificationDescription(listing);
    const locations = listing.location ? [listing.location] : [];
    const departments = listing.category ? [listing.category] : [];

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
        description,
        season: inferSeason([roleName, listing.category, description].filter(Boolean).join(" ")),
      }),
    );
  }

  return buildRoleParseResult(listings.length, roles, rejected);
}

export function shouldPrefetchLockheedJobsDetail(
  listing: LockheedJobsListing,
  searchKeyword: string,
): boolean {
  if (/^intern(?:ship)?$/i.test(searchKeyword.trim())) {
    return true;
  }

  const haystack = [listing.title, listing.category, listing.location].filter(Boolean).join(" ");
  return INTERNSHIP_LIST_TITLE_PATTERN.test(haystack);
}

export function buildLockheedJobsSearchUrl(
  careersOrigin: string,
  searchKeyword: string,
  page: number,
): string {
  const url = new URL(`${careersOrigin.replace(/\/$/, "")}/search-jobs`);
  url.searchParams.set("k", searchKeyword);
  url.searchParams.set("l", "");
  url.searchParams.set("listFilterMode", "1");
  if (page > 1) {
    url.searchParams.set("p", String(page));
  }
  return url.toString();
}

export function buildLockheedJobsPostingUrl(careersOrigin: string, relativePath: string): string | null {
  const trimmed = relativePath.trim();
  if (!trimmed.startsWith("/job/") || !isLockheedJobsJobPath(trimmed)) {
    return null;
  }
  return `${careersOrigin.replace(/\/$/, "")}${trimmed}`;
}

export function isLockheedJobsJobPath(relativePath: string): boolean {
  return /\/\d+\/\d+\/?$/i.test(relativePath);
}

export function parseLockheedJobsOrigin(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.hostname.toLowerCase() === "www.lockheedmartinjobs.com") {
      return `${parsed.protocol}//${parsed.host}`;
    }
    return null;
  } catch {
    return null;
  }
}

export function resolveLockheedMartinBoard(source: CompanySourceConfig): LockheedMartinBoardConfig {
  const fromToken = parseLockheedBoardToken(source.boardToken);
  const fromUrl = parseLockheedBoardFromUrl(source.sourceUrl);

  const partnerId =
    fromToken?.partnerId ?? fromUrl?.partnerId ?? LOCKHEED_MARTIN_DEFAULT_PARTNER_ID;
  const siteId = fromToken?.siteId ?? fromUrl?.siteId ?? LOCKHEED_MARTIN_DEFAULT_SITE_ID;
  const careersHomeUrl = normalizeLockheedCareersHomeUrl(source.sourceUrl, partnerId, siteId);

  return { partnerId, siteId, careersHomeUrl };
}

export function parseLockheedBoardToken(
  boardToken: string | null | undefined,
): { partnerId: string; siteId: string } | null {
  const trimmed = boardToken?.trim();
  if (!trimmed) {
    return null;
  }

  const colon = trimmed.match(/^(\d+)\s*:\s*(\d+)$/);
  if (colon) {
    return { partnerId: colon[1], siteId: colon[2] };
  }

  if (/^\d+$/.test(trimmed)) {
    return {
      partnerId: LOCKHEED_MARTIN_DEFAULT_PARTNER_ID,
      siteId: trimmed,
    };
  }

  return null;
}

export function parseLockheedBoardFromUrl(
  sourceUrl: string,
): { partnerId: string; siteId: string } | null {
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.hostname.toLowerCase() !== "sjobs.brassring.com") {
      return null;
    }

    const partnerId =
      parsed.searchParams.get("partnerid")?.trim() ||
      parsed.searchParams.get("partnerId")?.trim() ||
      null;
    const siteId =
      parsed.searchParams.get("siteid")?.trim() ||
      parsed.searchParams.get("siteId")?.trim() ||
      null;

    if (!partnerId || !siteId) {
      return null;
    }

    return { partnerId, siteId };
  } catch {
    return null;
  }
}

export function normalizeLockheedCareersHomeUrl(
  sourceUrl: string,
  partnerId: string,
  siteId: string,
): string {
  const trimmed = sourceUrl.trim();
  if (trimmed) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.hostname.toLowerCase() === "sjobs.brassring.com") {
        parsed.searchParams.set("partnerid", partnerId);
        parsed.searchParams.set("siteid", siteId);
        return parsed.toString();
      }
    } catch {
      // fall through
    }
  }

  const url = new URL(`${LOCKHEED_MARTIN_BRASSRING_ORIGIN}/TGnewUI/Search/Home/Home`);
  url.searchParams.set("partnerid", partnerId);
  url.searchParams.set("siteid", siteId);
  return url.toString();
}

export function buildLockheedMartinPostingUrl(
  board: LockheedMartinBoardConfig,
  reqId: string,
): string {
  const url = new URL(`${LOCKHEED_MARTIN_BRASSRING_ORIGIN}/TGnewUI/Search/Home/HomeWithPreLoad`);
  url.searchParams.set("partnerid", board.partnerId);
  url.searchParams.set("siteid", board.siteId);
  url.searchParams.set("PageType", "JobDetails");
  url.searchParams.set("jobid", reqId);
  return url.toString();
}

export function parseBrassRingJobQuestions(
  questions: BrassRingQuestion[] | undefined,
): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const question of questions ?? []) {
    const key = (question.QuestionName?.trim() || question.VerityZone?.trim() || "").toLowerCase();
    const value = (question.Value ?? question.AnswerValue ?? "").toString().trim();
    if (!key || !value) {
      continue;
    }
    fields[key] = value;
  }
  return fields;
}

export function parseBrassRingJobSummary(block: BrassRingJobBlock): BrassRingJobSummary | null {
  const fields = parseBrassRingJobQuestions(block.Questions);
  const reqId = fields.reqid?.trim();
  const title = decodeBrassRingEntities(fields.jobtitle?.trim() ?? "");
  if (!reqId || !title) {
    return null;
  }

  return {
    reqId,
    title,
    state: decodeBrassRingEntities(fields.formtext27?.trim() ?? "") || null,
    businessArea: decodeBrassRingEntities(fields.formtext13?.trim() ?? "") || null,
    qualificationsSnippet: fields.formtext23?.trim() || null,
    jobCode: decodeBrassRingEntities(fields.formtext2?.trim() ?? "") || null,
    program: decodeBrassRingEntities(fields.formtext8?.trim() ?? "") || null,
    lastUpdated: fields.lastupdated?.trim() || null,
  };
}

export function parseBrassRingJobDetailResponse(
  payload: BrassRingJobDetailsResponse,
  summary: BrassRingJobSummary,
): BrassRingJobDetail {
  const fields = parseBrassRingJobQuestions(
    payload.ServiceResponse?.Jobdetails?.JobDetailQuestions,
  );

  return {
    ...summary,
    title: decodeBrassRingEntities(fields.jobtitle?.trim() ?? summary.title),
    description: fields.formtext20?.trim() || null,
    basicQualifications: fields.formtext23?.trim() || null,
    city: decodeBrassRingEntities(fields.formtext46?.trim() ?? "") || null,
    cityState: decodeBrassRingEntities(fields.formtext63?.trim() ?? "") || null,
    jobClass: decodeBrassRingEntities(fields.formtext5?.trim() ?? "") || null,
    employmentType: decodeBrassRingEntities(fields.formtext15?.trim() ?? "") || null,
    state: decodeBrassRingEntities(fields.formtext27?.trim() ?? "") || summary.state,
    businessArea: decodeBrassRingEntities(fields.formtext13?.trim() ?? "") || summary.businessArea,
    jobCode: decodeBrassRingEntities(fields.formtext2?.trim() ?? "") || summary.jobCode,
    program: decodeBrassRingEntities(fields.formtext8?.trim() ?? "") || summary.program,
  };
}

export function isLockheedListCandidate(summary: BrassRingJobSummary): boolean {
  const haystack = [
    summary.title,
    summary.jobCode,
    summary.program,
    summary.qualificationsSnippet,
  ]
    .filter(Boolean)
    .join(" ");

  return LIST_CANDIDATE_PATTERN.test(haystack);
}

export function formatLockheedLocation(detail: BrassRingJobDetail): string | null {
  if (detail.cityState?.trim()) {
    return detail.cityState.trim();
  }

  const city = detail.city?.trim();
  const state = detail.state?.trim();
  if (city && state) {
    return `${city}, ${state}`;
  }
  if (state) {
    return state;
  }
  if (city) {
    return city;
  }
  return null;
}

export function parseLockheedMartinJobs(
  details: BrassRingJobDetail[],
  source: CompanySourceConfig,
  fetched: number,
): RoleParseResult {
  const board = resolveLockheedMartinBoard(source);
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const detail of details) {
    const roleName = detail.title.trim();
    const postingUrl = buildLockheedMartinPostingUrl(board, detail.reqId);
    const location = formatLockheedLocation(detail);
    const description = buildLockheedClassificationDescription(detail);

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      employmentType: detail.employmentType,
      team: detail.jobClass,
      departments: detail.businessArea ? [detail.businessArea] : [],
      locations: location ? [location] : [],
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

    const seasonText = [
      roleName,
      detail.program,
      detail.jobClass,
      detail.employmentType,
      description,
      detail.lastUpdated,
    ]
      .filter(Boolean)
      .join(" ");

    roles.push(
      buildScrapedRole({
        postingUrl,
        roleName,
        companyName: source.companyName,
        companySlug: source.companySlug,
        classification,
        description: buildLockheedClassificationDescription(detail),
        season: inferSeason(seasonText),
      }),
    );
  }

  return buildRoleParseResult(fetched, roles, rejected);
}

export function parseBrassRingMatchedJobsResponse(
  payload: BrassRingMatchedJobsResponse,
): BrassRingJobSummary[] {
  const blocks = normalizeBrassRingJobBlocks(payload.Jobs?.Job);
  const summaries: BrassRingJobSummary[] = [];

  for (const block of blocks) {
    const summary = parseBrassRingJobSummary(block);
    if (summary) {
      summaries.push(summary);
    }
  }

  return summaries;
}

function buildLockheedClassificationDescription(detail: BrassRingJobDetail): string {
  const parts = [
    detail.description,
    detail.basicQualifications,
    detail.jobCode,
    detail.program,
    detail.jobClass,
  ].filter(Boolean);

  return htmlToPlainText(parts.join("\n"));
}

async function fetchBrassRingSession(board: LockheedMartinBoardConfig): Promise<BrassRingSession> {
  const res = await brassRingFetch(board.careersHomeUrl, { method: "GET" });
  const html = await res.text();

  if (!res.ok || html.includes("internal server error")) {
    throw new Error(`Lockheed Martin BrassRing home returned ${res.status}`);
  }

  const requestVerificationToken = html.match(RFT_PATTERN)?.[1]?.trim();
  const encryptedSessionValue = html.match(SESSION_PATTERN)?.[1]?.trim();
  const cookieHeader = mergeCookieHeaders(res.headers.getSetCookie?.() ?? []);

  if (!requestVerificationToken || !encryptedSessionValue) {
    throw new Error("Lockheed Martin BrassRing session tokens missing from careers home HTML");
  }

  return {
    board,
    cookieHeader: cookieHeader ?? "",
    requestVerificationToken,
    encryptedSessionValue,
  };
}

async function fetchAllLockheedSummaries(session: BrassRingSession): Promise<BrassRingJobSummary[]> {
  const byReqId = new Map<string, BrassRingJobSummary>();

  for (const keyword of SEARCH_KEYWORDS) {
    const batch = await fetchKeywordSummaries(session, keyword);
    for (const summary of batch) {
      byReqId.set(summary.reqId, summary);
    }
  }

  return Array.from(byReqId.values());
}

async function fetchKeywordSummaries(
  session: BrassRingSession,
  keyword: string,
): Promise<BrassRingJobSummary[]> {
  const first = await postMatchedJobs(session, keyword, 1);
  const summaries = parseBrassRingMatchedJobsResponse(first);
  const total = first.JobsCount ?? summaries.length;

  if (total <= summaries.length) {
    return summaries;
  }

  const merged = [...summaries];
  for (let page = 2; page <= MAX_PAGES_PER_KEYWORD; page += 1) {
    const next = await postShowMoreJobs(session, keyword, page);
    const pageSummaries = parseBrassRingMatchedJobsResponse(next);
    if (pageSummaries.length === 0) {
      break;
    }
    merged.push(...pageSummaries);
    if (merged.length >= total) {
      break;
    }
  }

  return dedupeSummariesByReqId(merged);
}

async function postMatchedJobs(
  session: BrassRingSession,
  keyword: string,
  _pageNumber: number,
): Promise<BrassRingMatchedJobsResponse> {
  const body = buildMatchedJobsBody(session, keyword);
  const res = await brassRingPost(session, MATCHED_JOBS_URL, body);
  return parseBrassRingJson<BrassRingMatchedJobsResponse>(res, "MatchedJobs");
}

async function postShowMoreJobs(
  session: BrassRingSession,
  keyword: string,
  pageNumber: number,
): Promise<BrassRingMatchedJobsResponse> {
  const body = buildMatchedJobsBody(session, keyword);
  body.set("pageNumber", String(pageNumber));
  body.set("encryptedSessionValue", session.encryptedSessionValue);

  const res = await brassRingPost(session, SHOW_MORE_JOBS_URL, body);
  return parseBrassRingJson<BrassRingMatchedJobsResponse>(res, "ProcessSortAndShowMoreJobs");
}

function buildMatchedJobsBody(session: BrassRingSession, keyword: string): URLSearchParams {
  const { board, encryptedSessionValue } = session;
  const body = new URLSearchParams();
  body.set("PartnerId", board.partnerId);
  body.set("SiteId", board.siteId);
  body.set("Keyword", keyword);
  body.set("Location", "");
  body.set("Latitude", "0");
  body.set("Longitude", "0");
  body.set("EncryptedSessionValue", encryptedSessionValue);
  return body;
}

async function enrichLockheedSummaries(
  session: BrassRingSession,
  summaries: BrassRingJobSummary[],
): Promise<BrassRingJobDetail[]> {
  const details: BrassRingJobDetail[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < summaries.length) {
      const current = summaries[index];
      index += 1;
      try {
        const detail = await fetchLockheedJobDetail(session, current);
        details.push(detail);
      } catch {
        details.push({
          ...current,
          description: null,
          basicQualifications: current.qualificationsSnippet,
          city: null,
          cityState: current.state,
          jobClass: null,
          employmentType: null,
        });
      }
    }
  }

  const workers = Array.from({ length: Math.min(DETAIL_CONCURRENCY, summaries.length) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return details;
}

async function fetchLockheedJobDetail(
  session: BrassRingSession,
  summary: BrassRingJobSummary,
): Promise<BrassRingJobDetail> {
  const res = await brassRingPost(
    session,
    JOB_DETAILS_URL,
    JSON.stringify({
      partnerid: session.board.partnerId,
      siteid: session.board.siteId,
      jobid: summary.reqId,
      jobSiteId: session.board.siteId,
    }),
    "application/json; charset=UTF-8",
  );

  const payload = await parseBrassRingJson<BrassRingJobDetailsResponse>(res, "JobDetails");
  return parseBrassRingJobDetailResponse(payload, summary);
}

async function brassRingPost(
  session: BrassRingSession,
  url: string,
  body: URLSearchParams | string,
  contentType = "application/x-www-form-urlencoded; charset=UTF-8",
): Promise<Response> {
  return brassRingFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      RFT: session.requestVerificationToken,
      Origin: LOCKHEED_MARTIN_BRASSRING_ORIGIN,
      Referer: session.board.careersHomeUrl,
      Cookie: session.cookieHeader,
    },
    body: body instanceof URLSearchParams ? body.toString() : body,
  });
}

async function brassRingFetch(url: string, init: RequestInit): Promise<Response> {
  const res = await fetchWithTimeout(url, {
    ...init,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: init.method === "POST" ? "application/json, text/plain, */*" : "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw new Error(`Lockheed Martin BrassRing returned ${res.status} for ${url}`);
  }

  return res;
}

async function parseBrassRingJson<T>(res: Response, label: string): Promise<T> {
  const text = await res.text();
  if (text.trimStart().startsWith("<")) {
    throw new Error(`Lockheed Martin BrassRing ${label} returned HTML instead of JSON`);
  }
  return JSON.parse(text) as T;
}

function normalizeBrassRingJobBlocks(
  job: BrassRingJobBlock | BrassRingJobBlock[] | undefined,
): BrassRingJobBlock[] {
  if (!job) {
    return [];
  }
  return Array.isArray(job) ? job : [job];
}

function dedupeSummariesByReqId(summaries: BrassRingJobSummary[]): BrassRingJobSummary[] {
  const byReqId = new Map<string, BrassRingJobSummary>();
  for (const summary of summaries) {
    byReqId.set(summary.reqId, summary);
  }
  return Array.from(byReqId.values());
}

async function fetchAllLockheedJobsListings(board: LockheedJobsBoardConfig): Promise<LockheedJobsListing[]> {
  const all: LockheedJobsListing[] = [];
  let totalPages = 1;

  for (let page = 1; page <= LOCKHEED_JOBS_MAX_PAGES; page += 1) {
    const url = buildLockheedJobsSearchUrl(board.careersOrigin, board.searchKeyword, page);
    const html = await fetchLockheedJobsHtml(url);
    const batch = parseLockheedJobsSearchHtml(html, board.careersOrigin);
    all.push(...batch);

    const parsedTotalPages = parseLockheedJobsTotalPages(html);
    if (parsedTotalPages !== null) {
      totalPages = parsedTotalPages;
    }

    if (page >= totalPages || batch.length < LOCKHEED_JOBS_PAGE_SIZE) {
      break;
    }
  }

  return dedupeLockheedJobsByUrl(all);
}

async function enrichLockheedJobsListings(
  listings: LockheedJobsListing[],
  board: LockheedJobsBoardConfig,
): Promise<LockheedJobsListing[]> {
  const targets = listings.filter((listing) =>
    shouldPrefetchLockheedJobsDetail(listing, board.searchKeyword),
  );
  if (targets.length === 0) {
    return listings;
  }

  const details = new Map<string, ReturnType<typeof parseLockheedJobsDetailFields>>();
  let index = 0;

  async function worker(): Promise<void> {
    while (index < targets.length) {
      const current = targets[index];
      index += 1;
      if (!current) {
        continue;
      }
      try {
        const html = await fetchLockheedJobsHtml(current.postingUrl);
        details.set(current.postingUrl, parseLockheedJobsDetailFields(html));
      } catch {
        details.set(current.postingUrl, {
          category: null,
          location: null,
          description: "",
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(LOCKHEED_JOBS_DETAIL_CONCURRENCY, targets.length) }, () => worker()),
  );

  return listings.map((listing) => {
    const detail = details.get(listing.postingUrl);
    if (!detail) {
      return listing;
    }
    return {
      ...listing,
      category: detail.category ?? listing.category,
      location: detail.location ?? listing.location,
      description: detail.description || listing.description,
    };
  });
}

async function fetchLockheedJobsHtml(url: string): Promise<string> {
  const res = await fetchJsonWithTimeout(url, {
    headers: { accept: "text/html,application/xhtml+xml" },
  });
  if (!res.ok) {
    throw new Error(`Lockheed Martin careers returned ${res.status} for ${url}`);
  }
  return res.text();
}

function parseLockheedJobsTotalPages(html: string): number | null {
  const match = html.match(/data-total-pages="(\d+)"/i);
  if (!match) {
    return null;
  }
  const parsed = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseLockheedJobsSearchKeywordFromUrl(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.hostname.toLowerCase() !== "www.lockheedmartinjobs.com") {
      return null;
    }
    const keyword = parsed.searchParams.get("k")?.trim();
    if (keyword) {
      return keyword;
    }
    const pathMatch = parsed.pathname.match(/\/search-jobs\/([^/]+)\/?$/i);
    return pathMatch?.[1]?.replace(/-/g, " ") ?? null;
  } catch {
    return null;
  }
}

function normalizeLockheedJobsSearchUrl(sourceUrl: string, searchKeyword: string): string {
  const trimmed = sourceUrl.trim();
  if (trimmed) {
    try {
      const parsed = new URL(trimmed);
      if (
        parsed.hostname.toLowerCase() === "www.lockheedmartinjobs.com" &&
        parsed.pathname.includes("search-jobs")
      ) {
        parsed.pathname = "/search-jobs";
        parsed.searchParams.set("k", searchKeyword);
        parsed.searchParams.set("l", "");
        parsed.searchParams.set("listFilterMode", "1");
        parsed.searchParams.delete("p");
        return parsed.toString();
      }
    } catch {
      // fall through
    }
  }

  return buildLockheedJobsSearchUrl(LOCKHEED_MARTIN_JOBS_ORIGIN, searchKeyword, 1);
}

function normalizeLockheedJobsListLocation(location: string | null): string | null {
  if (!location) {
    return null;
  }
  const trimmed = location.trim();
  if (!trimmed || /^multiple locations$/i.test(trimmed)) {
    return trimmed || null;
  }
  return trimmed;
}

function buildLockheedJobsClassificationDescription(listing: LockheedJobsListing): string {
  const boost: string[] = [];
  if (listing.category && /internship|student|university|co op/i.test(listing.category)) {
    boost.push(listing.category);
  }
  if (/\bintern(?:ship)?\b/i.test(listing.title)) {
    boost.push("internship program");
  }

  return [...boost, listing.description ?? ""].filter(Boolean).join("\n");
}

function dedupeLockheedJobsByUrl(listings: LockheedJobsListing[]): LockheedJobsListing[] {
  const byUrl = new Map<string, LockheedJobsListing>();
  for (const listing of listings) {
    byUrl.set(listing.postingUrl, listing);
  }
  return Array.from(byUrl.values());
}
