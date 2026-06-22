import { decodeHtmlEntities, stripHtml } from "../html-utils.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, resolveBoardToken } from "./shared.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";

/**
 * Intuit careers run on Radancy TalentBrew (jobs.intuit.com) with Avature apply links.
 * Open roles are listed on HTML search pages; detail pages carry category and description.
 */
export const INTUIT_CAREERS_ORIGIN = "https://jobs.intuit.com";
export const INTUIT_DEFAULT_ORG_ID = "27595";
export const INTUIT_DEFAULT_SEARCH_KEYWORD = "internship";
export const INTUIT_DEFAULT_SEARCH_URL = `${INTUIT_CAREERS_ORIGIN}/search-jobs?k=internship&l=&listFilterMode=1`;

const INTUIT_PAGE_SIZE = 15;
const INTUIT_MAX_PAGES = 40;
const INTUIT_DETAIL_CONCURRENCY = 6;

/** List titles must look internship-related before we fetch full descriptions. */
const INTUIT_LISTING_PATTERN =
  /<a href="(\/job\/[^"]+)"[^>]*class="sr-item"[^>]*>[\s\S]*?<h2>([^<]+)<\/h2>[\s\S]*?<span class="job-location">([^<]*)<\/span>/gi;

export interface IntuitBoardConfig {
  careersOrigin: string;
  orgId: string;
  searchKeyword: string;
  searchUrl: string;
}

export interface IntuitListing {
  title: string;
  postingUrl: string;
  location: string | null;
  category: string | null;
  description?: string | null;
  datePosted?: string | null;
}

export function createIntuitAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveIntuitBoard(source);
  const resolvedSource =
    source.boardToken === board.searchKeyword && source.sourceUrl === board.searchUrl
      ? source
      : { ...source, boardToken: board.searchKeyword, sourceUrl: board.searchUrl };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const listings = await fetchAllIntuitListings(board);
      const enriched = await enrichIntuitListings(listings, board);
      return parseIntuitJobs(enriched, resolvedSource);
    },
  };
}

export function resolveIntuitBoard(source: CompanySourceConfig): IntuitBoardConfig {
  const searchKeyword =
    resolveBoardToken(source, parseIntuitSearchKeywordFromUrl) || INTUIT_DEFAULT_SEARCH_KEYWORD;
  const orgId = parseIntuitOrgIdFromUrl(source.sourceUrl) ?? INTUIT_DEFAULT_ORG_ID;
  const searchUrl = normalizeIntuitSearchUrl(source.sourceUrl, searchKeyword);

  return {
    careersOrigin: INTUIT_CAREERS_ORIGIN,
    orgId,
    searchKeyword,
    searchUrl,
  };
}

export function parseIntuitSearchJobsHtml(html: string, careersOrigin: string): IntuitListing[] {
  const listings: IntuitListing[] = [];

  for (const match of html.matchAll(INTUIT_LISTING_PATTERN)) {
    const relativePath = decodeHtmlEntities(match[1]?.trim() ?? "");
    const title = decodeHtmlEntities(stripHtml(match[2] ?? ""));
    const location = decodeHtmlEntities(stripHtml(match[3] ?? "")) || null;
    if (!relativePath || !title) {
      continue;
    }

    const postingUrl = buildIntuitPostingUrl(careersOrigin, relativePath);
    if (!postingUrl) {
      continue;
    }

    listings.push({
      title,
      postingUrl,
      location: normalizeIntuitListLocation(location),
      category: null,
    });
  }

  return dedupeListingsByUrl(listings);
}

export function parseIntuitJobDetailFields(html: string): {
  category: string | null;
  location: string | null;
  description: string;
} {
  const category =
    html.match(/<span class="job-category-jd[^"]*"[^>]*>\s*<b>Category<\/b>\s*([^<]+)/i)?.[1]?.trim() ??
    null;

  const locationFromData =
    html.match(/<span class="job-location-jd[^"]*"[^>]*data-drew="([^"]+)"/i)?.[1]?.trim() ?? null;
  const locationFromText =
    html.match(/<span class="job-location-jd[^"]*"[^>]*>[\s\S]*?<b>Location<\/b>\s*([^<]+)/i)?.[1]?.trim() ??
    null;
  const location = locationFromData ?? locationFromText ?? null;

  const descriptionParts: string[] = [];
  for (const pattern of [
    /<div id="job-description-wrapper"[^>]*>([\s\S]*?)<\/div>\s*<div id="job-team"/i,
    /<div id="job-team"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/section>/i,
  ]) {
    const block = html.match(pattern)?.[1];
    if (block) {
      const text = htmlToPlainText(block);
      if (text.length > 40) {
        descriptionParts.push(text);
      }
    }
  }

  return {
    category,
    location,
    description: descriptionParts.join("\n"),
  };
}

export function parseIntuitJobs(listings: IntuitListing[], source: CompanySourceConfig): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const listing of listings) {
    const roleName = listing.title.trim();
    const postingUrl = listing.postingUrl.trim();
    const description = buildIntuitClassificationDescription(listing);
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
        description: buildIntuitClassificationDescription(listing),
        atsDates: {
          publishedAt: listing.datePosted ?? null,
        },
      }),
    );
  }

  return buildRoleParseResult(listings.length, roles, rejected);
}

export function shouldPrefetchIntuitDetail(listing: IntuitListing, searchKeyword: string): boolean {
  if (/^intern(?:ship)?$/i.test(searchKeyword.trim())) {
    return true;
  }

  const haystack = [listing.title, listing.category, listing.location].filter(Boolean).join(" ");
  return INTERNSHIP_LIST_TITLE_PATTERN.test(haystack);
}

export function buildIntuitSearchUrl(careersOrigin: string, searchKeyword: string, page: number): string {
  const url = new URL(`${careersOrigin.replace(/\/$/, "")}/search-jobs`);
  url.searchParams.set("k", searchKeyword);
  url.searchParams.set("l", "");
  url.searchParams.set("listFilterMode", "1");
  if (page > 1) {
    url.searchParams.set("p", String(page));
  }
  return url.toString();
}

export function buildIntuitPostingUrl(careersOrigin: string, relativePath: string): string | null {
  const trimmed = relativePath.trim();
  if (!trimmed.startsWith("/job/")) {
    return null;
  }
  return `${careersOrigin.replace(/\/$/, "")}${trimmed}`;
}

async function fetchAllIntuitListings(board: IntuitBoardConfig): Promise<IntuitListing[]> {
  const all: IntuitListing[] = [];
  let totalPages = 1;

  for (let page = 1; page <= INTUIT_MAX_PAGES; page += 1) {
    const url = buildIntuitSearchUrl(board.careersOrigin, board.searchKeyword, page);
    const html = await fetchIntuitHtml(url);
    const batch = parseIntuitSearchJobsHtml(html, board.careersOrigin);
    all.push(...batch);

    const parsedTotalPages = parseIntuitTotalPages(html);
    if (parsedTotalPages !== null) {
      totalPages = parsedTotalPages;
    }

    if (page >= totalPages || batch.length < INTUIT_PAGE_SIZE) {
      break;
    }
  }

  return dedupeListingsByUrl(all);
}

async function enrichIntuitListings(
  listings: IntuitListing[],
  board: IntuitBoardConfig,
): Promise<IntuitListing[]> {
  const targets = listings.filter((listing) => shouldPrefetchIntuitDetail(listing, board.searchKeyword));
  if (targets.length === 0) {
    return listings;
  }

  const details = new Map<string, ReturnType<typeof parseIntuitJobDetailFields>>();
  let index = 0;

  async function worker(): Promise<void> {
    while (index < targets.length) {
      const current = targets[index];
      index += 1;
      if (!current) {
        continue;
      }
      try {
        const html = await fetchIntuitHtml(current.postingUrl);
        details.set(current.postingUrl, parseIntuitJobDetailFields(html));
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
    Array.from({ length: Math.min(INTUIT_DETAIL_CONCURRENCY, targets.length) }, () => worker()),
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

async function fetchIntuitHtml(url: string): Promise<string> {
  const res = await fetchJsonWithTimeout(url, {
    headers: { accept: "text/html,application/xhtml+xml" },
  });
  if (!res.ok) {
    throw new Error(`Intuit careers returned ${res.status} for ${url}`);
  }
  return res.text();
}

function parseIntuitTotalPages(html: string): number | null {
  const match = html.match(/data-total-pages="(\d+)"/i);
  if (!match) {
    return null;
  }
  const parsed = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseIntuitSearchKeywordFromUrl(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.hostname.toLowerCase() !== "jobs.intuit.com") {
      return null;
    }
    const keyword = parsed.searchParams.get("k")?.trim();
    return keyword || null;
  } catch {
    return null;
  }
}

function parseIntuitOrgIdFromUrl(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    const match = parsed.pathname.match(/\/job\/[^/]+\/[^/]+\/(\d+)\/\d+/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function normalizeIntuitSearchUrl(sourceUrl: string, searchKeyword: string): string {
  const trimmed = sourceUrl.trim();
  if (trimmed) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.hostname.toLowerCase() === "jobs.intuit.com" && parsed.pathname.includes("search-jobs")) {
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

  return buildIntuitSearchUrl(INTUIT_CAREERS_ORIGIN, searchKeyword, 1);
}

function normalizeIntuitListLocation(location: string | null): string | null {
  if (!location) {
    return null;
  }
  const trimmed = location.trim();
  if (!trimmed || /^multiple locations$/i.test(trimmed)) {
    return trimmed || null;
  }
  return trimmed;
}

function buildIntuitClassificationDescription(listing: IntuitListing): string {
  const boost: string[] = [];
  if (listing.category && /internship|university/i.test(listing.category)) {
    boost.push(listing.category);
  }
  if (/\bintern(?:ship)?\b/i.test(listing.title)) {
    boost.push("internship program");
  }

  return [...boost, listing.description ?? ""].filter(Boolean).join("\n");
}

function dedupeListingsByUrl(listings: IntuitListing[]): IntuitListing[] {
  const byUrl = new Map<string, IntuitListing>();
  for (const listing of listings) {
    byUrl.set(listing.postingUrl, listing);
  }
  return Array.from(byUrl.values());
}

