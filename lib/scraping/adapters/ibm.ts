import { extractAvatureDetailDatePosted } from "../avature-dates.ts";
import { stripHtml } from "../html-utils.ts";
import { atsPublishDate } from "../posted-date.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, resolveBoardToken, safeToIsoDate } from "./shared.ts";

/**
 * IBM careers run on Avature (ibmglobal.avature.net / careers.ibm.com).
 * Intern listings are on SearchJobs/intern HTML pages behind AWS WAF; a portal
 * session cookie from the landing page is required before paginated fetches.
 */
export const IBM_CAREERS_ORIGIN = "https://ibmglobal.avature.net";
export const IBM_POSTING_ORIGIN = "https://careers.ibm.com";
export const IBM_DEFAULT_LOCALE = "en_US";
export const IBM_SEARCH_JOBS_URL = `${IBM_CAREERS_ORIGIN}/${IBM_DEFAULT_LOCALE}/careers/SearchJobs/intern`;
export const IBM_DEFAULT_PORTAL_ID = "4";

const IBM_PAGE_SIZE = 12;
const IBM_MAX_PAGES = 15;
const IBM_DETAIL_CONCURRENCY = 6;

/** List titles that may be internships before we fetch JobDetail for publish dates. */
const INTERNSHIP_LIST_TITLE_PATTERN =
  /\bintern(?:ship|ships)?\b|\bco-?op\b|\bfellowship\b|\buniversity\b|\bapprentice\b/i;

const ARTICLE_BLOCK_PATTERN = /<article[^>]*>([\s\S]*?)<\/article>/gi;

const JOB_ID_PATTERN = /JobDetail\?jobId=(\d+)/i;

const TITLE_LINK_PATTERN =
  /article__header__text__title[\s\S]*?<a class="link"[^>]*>\s*([\s\S]*?)\s*<\/a>/i;

const DEPARTMENT_PATTERN =
  /article__header__text__pretitle[\s\S]*?<a class="link[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/a>/i;

const CARD_ITEM_PATTERN = /<span class="card-item[^"]*">([\s\S]*?)<\/span>/gi;

const EMPLOYMENT_TYPE_PATTERN = /<span class="card-item card-item-type">([\s\S]*?)<\/span>/i;

export interface IbmBoardConfig {
  portalId: string;
  locale: string;
  searchJobsUrl: string;
}

export interface IbmListing {
  title: string;
  postingUrl: string;
  location: string | null;
  department: string | null;
  employmentType: string | null;
  description?: string | null;
  datePosted?: string | null;
}

export interface IbmSession {
  cookie: string | null;
  referer: string;
}

export function createIbmAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveIbmBoard(source);
  const resolvedSource =
    source.boardToken === board.portalId && source.sourceUrl === board.searchJobsUrl
      ? source
      : { ...source, boardToken: board.portalId, sourceUrl: board.searchJobsUrl };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const session = await fetchIbmSession(board.searchJobsUrl);
      const listings = await fetchAllIbmListings(board, session);
      const enriched = await enrichIbmListings(listings, session);
      return parseIbmJobs(enriched, resolvedSource);
    },
  };
}

export function resolveIbmBoard(source: CompanySourceConfig): IbmBoardConfig {
  const portalId =
    resolveBoardToken(source, () => IBM_DEFAULT_PORTAL_ID) || IBM_DEFAULT_PORTAL_ID;
  const locale = parseIbmLocaleFromUrl(source.sourceUrl) ?? IBM_DEFAULT_LOCALE;
  const searchJobsUrl = normalizeIbmSearchJobsUrl(source.sourceUrl, locale);

  return { portalId, locale, searchJobsUrl };
}

export function parseIbmLocaleFromUrl(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    const match = parsed.pathname.match(/^\/([^/]+)\/careers\//i);
    return match?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

export function normalizeIbmSearchJobsUrl(sourceUrl: string, locale: string): string {
  const trimmed = sourceUrl.trim();
  if (!trimmed) {
    return `${IBM_CAREERS_ORIGIN}/${locale}/careers/SearchJobs/intern`;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (host === "ibmglobal.avature.net" || host === "careers.ibm.com" || host === "www.ibm.com") {
      return `${IBM_CAREERS_ORIGIN}/${locale}/careers/SearchJobs/intern`;
    }
  } catch {
    return `${IBM_CAREERS_ORIGIN}/${locale}/careers/SearchJobs/intern`;
  }

  return `${IBM_CAREERS_ORIGIN}/${locale}/careers/SearchJobs/intern`;
}

export function buildIbmPostingUrl(board: IbmBoardConfig, jobId: string): string {
  const url = new URL(`${IBM_POSTING_ORIGIN}/${board.locale}/careers/JobDetail`);
  url.searchParams.set("jobId", jobId);
  return url.toString();
}

export function parseIbmSearchJobsHtml(html: string, board: IbmBoardConfig): IbmListing[] {
  const listings: IbmListing[] = [];

  for (const match of html.matchAll(ARTICLE_BLOCK_PATTERN)) {
    const block = match[1] ?? "";
    const jobIdMatch = block.match(JOB_ID_PATTERN);
    const titleMatch = block.match(TITLE_LINK_PATTERN);
    if (!jobIdMatch || !titleMatch) {
      continue;
    }

    const jobId = jobIdMatch[1].trim();
    const title = stripHtml(titleMatch[1]);
    const postingUrl = buildIbmPostingUrl(board, jobId);
    if (!title || !isHttpUrl(postingUrl)) {
      continue;
    }

    const department = stripHtml(block.match(DEPARTMENT_PATTERN)?.[1] ?? "") || null;
    const cardItems = [...block.matchAll(CARD_ITEM_PATTERN)].map((cardMatch) =>
      stripHtml(cardMatch[1] ?? ""),
    );
    const employmentType =
      stripHtml(block.match(EMPLOYMENT_TYPE_PATTERN)?.[1] ?? "") ||
      cardItems.find((item) => /internship|co-op|apprentice/i.test(item)) ||
      null;
    const location = inferIbmLocation(cardItems);

    listings.push({
      title,
      postingUrl,
      location,
      department,
      employmentType,
    });
  }

  return dedupeListingsByUrl(listings);
}

export function parseIbmJobDetailFields(html: string): {
  description: string;
  datePosted: string | null;
} {
  const descriptionBlock =
    html.match(/<div id="job-description-wrapper"[^>]*>([\s\S]*?)<\/div>\s*<div id="job-team"/i)?.[1] ??
    html.match(/<div class="ats-description">([\s\S]*?)<\/div>/i)?.[1];
  const description = descriptionBlock ? htmlToPlainText(descriptionBlock) : "";

  return {
    description,
    datePosted: extractAvatureDetailDatePosted(html),
  };
}

export function shouldPrefetchIbmDetail(listing: IbmListing): boolean {
  const haystack = [listing.title, listing.employmentType, listing.department]
    .filter(Boolean)
    .join(" ");
  return INTERNSHIP_LIST_TITLE_PATTERN.test(haystack);
}

export function parseIbmJobs(
  listings: IbmListing[],
  source: CompanySourceConfig,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const listing of listings) {
    const roleName = listing.title.trim();
    const postingUrl = listing.postingUrl.trim();
    const description = buildIbmClassificationDescription(listing, listing.description);
    const departments = listing.department ? [listing.department] : [];
    const locations = listing.location ? [listing.location] : [];

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      employmentType: listing.employmentType,
      team: listing.department,
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
        description: buildIbmClassificationDescription(listing, listing.description),
        dates: atsPublishDate(safeToIsoDate(listing.datePosted)),
      }),
    );
  }

  return buildRoleParseResult(listings.length, roles, rejected);
}

export function ibmBrowserHeaders(referer: string, cookie?: string | null): HeadersInit {
  return {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: referer,
    "Sec-Ch-Ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"macOS"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    ...(cookie ? { Cookie: cookie } : {}),
  };
}

export async function fetchIbmSession(searchJobsUrl: string): Promise<IbmSession> {
  const res = await fetchIbmResponse(searchJobsUrl, searchJobsUrl);
  const html = await res.text();
  if (isIbmWafChallenge(html)) {
    throw new Error(`IBM careers landing page returned AWS WAF challenge for ${searchJobsUrl}`);
  }

  const cookie = extractIbmCookies(res) ?? null;
  return { cookie, referer: searchJobsUrl };
}

function inferIbmLocation(cardItems: string[]): string | null {
  for (const item of cardItems) {
    const trimmed = item.trim();
    if (!trimmed) {
      continue;
    }
    if (/^internship$|^co-op$|^apprentice/i.test(trimmed)) {
      continue;
    }
    return trimmed;
  }
  return null;
}

function buildIbmClassificationDescription(listing: IbmListing, detailDescription?: string | null): string {
  const boost: string[] = ["internship program university student"];
  if (listing.employmentType && /internship|co-op|apprentice/i.test(listing.employmentType)) {
    boost.push("internship employment type");
  }
  if (listing.department && /software|engineering|cloud|infrastructure|data|research/i.test(listing.department)) {
    boost.push("engineering technology internship");
  }
  return [...boost, detailDescription ?? ""].filter(Boolean).join("\n");
}

async function enrichIbmListings(
  listings: IbmListing[],
  session: IbmSession,
): Promise<IbmListing[]> {
  const targets = listings.filter(shouldPrefetchIbmDetail);
  if (targets.length === 0) {
    return listings;
  }

  const details = new Map<string, ReturnType<typeof parseIbmJobDetailFields>>();
  let index = 0;

  async function worker(): Promise<void> {
    while (index < targets.length) {
      const current = targets[index];
      index += 1;
      if (!current) {
        continue;
      }
      try {
        const html = await fetchIbmHtml(current.postingUrl, session);
        details.set(current.postingUrl, parseIbmJobDetailFields(html));
      } catch {
        details.set(current.postingUrl, { description: "", datePosted: null });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(IBM_DETAIL_CONCURRENCY, targets.length) }, () => worker()),
  );

  return listings.map((listing) => {
    const detail = details.get(listing.postingUrl);
    if (!detail) {
      return listing;
    }
    return {
      ...listing,
      description: detail.description || listing.description,
      datePosted: detail.datePosted ?? listing.datePosted,
    };
  });
}

async function fetchAllIbmListings(board: IbmBoardConfig, session: IbmSession): Promise<IbmListing[]> {
  const all: IbmListing[] = [];

  for (let page = 0; page < IBM_MAX_PAGES; page += 1) {
    const offset = page * IBM_PAGE_SIZE;
    const url = `${board.searchJobsUrl}?jobRecordsPerPage=${IBM_PAGE_SIZE}&jobOffset=${offset}`;
    const html = await fetchIbmHtml(url, session);
    const batch = parseIbmSearchJobsHtml(html, board);
    all.push(...batch);

    if (batch.length < IBM_PAGE_SIZE) {
      break;
    }
    const nextOffset = offset + IBM_PAGE_SIZE;
    if (!html.includes(`jobOffset=${nextOffset}`)) {
      break;
    }
  }

  return dedupeListingsByUrl(all);
}

async function fetchIbmHtml(url: string, session: IbmSession): Promise<string> {
  const res = await fetchIbmResponse(url, session.referer, session.cookie);
  const html = await res.text();
  if (isIbmWafChallenge(html)) {
    throw new Error(`IBM careers returned AWS WAF challenge for ${url}`);
  }
  return html;
}

async function fetchIbmResponse(
  url: string,
  referer: string,
  cookie?: string | null,
): Promise<Response> {
  const res = await fetchJsonWithTimeout(url, {
    redirect: "manual",
    headers: ibmBrowserHeaders(referer, cookie),
  });

  if (res.status === 202 || res.status === 403) {
    throw new Error(`IBM careers returned ${res.status} for ${url}`);
  }

  if (!isIbmHtmlResponseStatus(res.status)) {
    throw new Error(`IBM careers returned ${res.status} for ${url}`);
  }

  return res;
}

function isIbmHtmlResponseStatus(status: number): boolean {
  return status === 200 || status === 301 || status === 302;
}

function extractIbmCookies(res: Response): string | null {
  const cookies = res.headers.getSetCookie?.().map((part) => part.split(";")[0]) ?? [];
  if (cookies.length === 0) {
    return null;
  }
  return cookies.join("; ");
}

function isIbmWafChallenge(html: string): boolean {
  return html.includes("awsWaf") || html.includes("AwsWafIntegration");
}

function dedupeListingsByUrl(listings: IbmListing[]): IbmListing[] {
  const byUrl = new Map<string, IbmListing>();
  for (const listing of listings) {
    byUrl.set(listing.postingUrl, listing);
  }
  return Array.from(byUrl.values());
}

