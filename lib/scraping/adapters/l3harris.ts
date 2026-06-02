import { extractJsonLdDatePosted } from "../avature-dates.ts";
import { decodeHtmlEntities, stripHtml } from "../html-utils.ts";
import { atsPublishDate } from "../posted-date.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, resolveBoardToken, safeToIsoDate } from "./shared.ts";

/**
 * L3Harris careers run on Radancy TalentBrew (careers.l3harris.com, org 4832).
 * Listings are HTML search pages; detail pages carry location and description in ats-description.
 */
export const L3HARRIS_CAREERS_ORIGIN = "https://careers.l3harris.com";
export const L3HARRIS_DEFAULT_ORG_ID = "4832";
export const L3HARRIS_DEFAULT_SEARCH_KEYWORD = "intern";
export const L3HARRIS_DEFAULT_SEARCH_URL = `${L3HARRIS_CAREERS_ORIGIN}/en/search-jobs?k=intern&l=&listFilterMode=1`;

const L3HARRIS_PAGE_SIZE = 15;
const L3HARRIS_MAX_PAGES = 40;
const L3HARRIS_DETAIL_CONCURRENCY = 6;

/** List titles must look internship-related before we fetch full descriptions. */
const INTERNSHIP_LIST_TITLE_PATTERN =
  /\bintern(?:ship|ships)?\b|\bco-?op\b|\bfellowship\b|\buniversity\b|\bskillbridge\b/i;

const L3HARRIS_LISTING_PATTERN =
  /<a href="(\/en\/job\/[^"]+)"[^>]*>[\s\S]*?<h2>([^<]+)<\/h2>[\s\S]*?<span class="results-facet job-category">([^<]*)<\/span>[\s\S]*?<span class="results-facet job-location[^"]*">([^<]*)<\/span>/gi;

export interface L3HarrisBoardConfig {
  careersOrigin: string;
  orgId: string;
  searchKeyword: string;
  searchUrl: string;
}

export interface L3HarrisListing {
  title: string;
  postingUrl: string;
  location: string | null;
  category: string | null;
  description?: string | null;
  datePosted?: string | null;
}

export function createL3HarrisAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveL3HarrisBoard(source);
  const resolvedSource =
    source.boardToken === board.searchKeyword && source.sourceUrl === board.searchUrl
      ? source
      : { ...source, boardToken: board.searchKeyword, sourceUrl: board.searchUrl };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const listings = await fetchAllL3HarrisListings(board);
      const enriched = await enrichL3HarrisListings(listings, board);
      return parseL3HarrisJobs(enriched, resolvedSource);
    },
  };
}

export function resolveL3HarrisBoard(source: CompanySourceConfig): L3HarrisBoardConfig {
  const searchKeyword =
    resolveBoardToken(source, parseL3HarrisSearchKeywordFromUrl) || L3HARRIS_DEFAULT_SEARCH_KEYWORD;
  const orgId = parseL3HarrisOrgIdFromUrl(source.sourceUrl) ?? L3HARRIS_DEFAULT_ORG_ID;
  const searchUrl = normalizeL3HarrisSearchUrl(source.sourceUrl, searchKeyword);

  return {
    careersOrigin: L3HARRIS_CAREERS_ORIGIN,
    orgId,
    searchKeyword,
    searchUrl,
  };
}

export function parseL3HarrisSearchJobsHtml(html: string, careersOrigin: string): L3HarrisListing[] {
  const listings: L3HarrisListing[] = [];

  for (const match of html.matchAll(L3HARRIS_LISTING_PATTERN)) {
    const relativePath = decodeHtmlEntities(match[1]?.trim() ?? "");
    const title = decodeHtmlEntities(stripHtml(match[2] ?? ""));
    const category = decodeHtmlEntities(stripHtml(match[3] ?? "")) || null;
    const location = decodeHtmlEntities(stripHtml(match[4] ?? "")) || null;
    if (!relativePath || !title || !isL3HarrisJobPath(relativePath)) {
      continue;
    }

    const postingUrl = buildL3HarrisPostingUrl(careersOrigin, relativePath);
    if (!postingUrl) {
      continue;
    }

    listings.push({
      title,
      postingUrl,
      location: normalizeL3HarrisListLocation(location),
      category,
    });
  }

  return dedupeListingsByUrl(listings);
}

export function parseL3HarrisJobDetailFields(html: string): {
  title: string | null;
  category: string | null;
  location: string | null;
  description: string;
  datePosted: string | null;
} {
  const title = html.match(/<h2 class="job-title-heading">([^<]+)/i)?.[1]?.trim() ?? null;

  const location = html.match(/<p class="ajd_header__location">([^<]+)/i)?.[1]?.trim() ?? null;

  const datePosted =
    extractJsonLdDatePosted(html) ??
    html.match(/<meta[^>]+property="og:updated_time"[^>]+content="([^"]+)"/i)?.[1]?.trim() ??
    null;

  const descriptionBlock =
    html.match(/<div class="ats-description">([\s\S]*?)<div class="qualifications"/i)?.[1] ??
    html.match(/<div class="ats-description">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i)?.[1];
  const description = descriptionBlock ? htmlToPlainText(descriptionBlock) : "";

  return {
    title,
    category: null,
    location,
    description,
    datePosted,
  };
}

export function parseL3HarrisJobs(
  listings: L3HarrisListing[],
  source: CompanySourceConfig,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const listing of listings) {
    const roleName = listing.title.trim();
    const postingUrl = listing.postingUrl.trim();
    const description = buildL3HarrisClassificationDescription(listing);
    const locations = listing.location ? [listing.location] : [];
    const departments = listing.category ? listing.category.split("|").map((part) => part.trim()) : [];

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
        description: buildL3HarrisClassificationDescription(listing),
        dates: atsPublishDate(safeToIsoDate(listing.datePosted)),
      }),
    );
  }

  return buildRoleParseResult(listings.length, roles, rejected);
}

export function shouldPrefetchL3HarrisDetail(
  listing: L3HarrisListing,
  searchKeyword: string,
): boolean {
  if (/^intern(?:ship)?$/i.test(searchKeyword.trim())) {
    return true;
  }

  const haystack = [listing.title, listing.category, listing.location].filter(Boolean).join(" ");
  return INTERNSHIP_LIST_TITLE_PATTERN.test(haystack);
}

export function buildL3HarrisSearchUrl(
  careersOrigin: string,
  searchKeyword: string,
  page: number,
): string {
  const url = new URL(`${careersOrigin.replace(/\/$/, "")}/en/search-jobs`);
  url.searchParams.set("k", searchKeyword);
  url.searchParams.set("l", "");
  url.searchParams.set("listFilterMode", "1");
  if (page > 1) {
    url.searchParams.set("p", String(page));
  }
  return url.toString();
}

export function buildL3HarrisPostingUrl(careersOrigin: string, relativePath: string): string | null {
  const trimmed = relativePath.trim();
  if (!trimmed.startsWith("/en/job/") || !isL3HarrisJobPath(trimmed)) {
    return null;
  }
  return `${careersOrigin.replace(/\/$/, "")}${trimmed}`;
}

export function isL3HarrisJobPath(relativePath: string): boolean {
  return /\/\d+\/\d+\/?$/i.test(relativePath);
}

async function fetchAllL3HarrisListings(board: L3HarrisBoardConfig): Promise<L3HarrisListing[]> {
  const all: L3HarrisListing[] = [];
  let totalPages = 1;

  for (let page = 1; page <= L3HARRIS_MAX_PAGES; page += 1) {
    const url = buildL3HarrisSearchUrl(board.careersOrigin, board.searchKeyword, page);
    const html = await fetchL3HarrisHtml(url);
    const batch = parseL3HarrisSearchJobsHtml(html, board.careersOrigin);
    all.push(...batch);

    const parsedTotalPages = parseL3HarrisTotalPages(html);
    if (parsedTotalPages !== null) {
      totalPages = parsedTotalPages;
    }

    if (page >= totalPages || batch.length < L3HARRIS_PAGE_SIZE) {
      break;
    }
  }

  return dedupeListingsByUrl(all);
}

async function enrichL3HarrisListings(
  listings: L3HarrisListing[],
  board: L3HarrisBoardConfig,
): Promise<L3HarrisListing[]> {
  const targets = listings.filter((listing) => shouldPrefetchL3HarrisDetail(listing, board.searchKeyword));
  if (targets.length === 0) {
    return listings;
  }

  const details = new Map<string, ReturnType<typeof parseL3HarrisJobDetailFields>>();
  let index = 0;

  async function worker(): Promise<void> {
    while (index < targets.length) {
      const current = targets[index];
      index += 1;
      if (!current) {
        continue;
      }
      try {
        const html = await fetchL3HarrisHtml(current.postingUrl);
        details.set(current.postingUrl, parseL3HarrisJobDetailFields(html));
      } catch {
        details.set(current.postingUrl, {
          title: null,
          category: null,
          location: null,
          description: "",
          datePosted: null,
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(L3HARRIS_DETAIL_CONCURRENCY, targets.length) }, () => worker()),
  );

  return listings.map((listing) => {
    const detail = details.get(listing.postingUrl);
    if (!detail) {
      return listing;
    }
    return {
      ...listing,
      title: detail.title ?? listing.title,
      category: detail.category ?? listing.category,
      location: detail.location ?? listing.location,
      description: detail.description || listing.description,
      datePosted: detail.datePosted ?? listing.datePosted,
    };
  });
}

async function fetchL3HarrisHtml(url: string): Promise<string> {
  const res = await fetchJsonWithTimeout(url, {
    headers: { accept: "text/html,application/xhtml+xml" },
  });
  if (!res.ok) {
    throw new Error(`L3Harris careers returned ${res.status} for ${url}`);
  }
  return res.text();
}

function parseL3HarrisTotalPages(html: string): number | null {
  const match = html.match(/data-total-pages="(\d+)"/i);
  if (!match) {
    return null;
  }
  const parsed = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseL3HarrisSearchKeywordFromUrl(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.hostname.toLowerCase() !== "careers.l3harris.com") {
      return null;
    }
    const keyword = parsed.searchParams.get("k")?.trim();
    return keyword || null;
  } catch {
    return null;
  }
}

function parseL3HarrisOrgIdFromUrl(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    const match = parsed.pathname.match(/\/job\/[^/]+\/[^/]+\/(\d+)\/\d+/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function normalizeL3HarrisSearchUrl(sourceUrl: string, searchKeyword: string): string {
  const trimmed = sourceUrl.trim();
  if (trimmed) {
    try {
      const parsed = new URL(trimmed);
      if (
        parsed.hostname.toLowerCase() === "careers.l3harris.com" &&
        parsed.pathname.includes("search-jobs")
      ) {
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

  return buildL3HarrisSearchUrl(L3HARRIS_CAREERS_ORIGIN, searchKeyword, 1);
}

function normalizeL3HarrisListLocation(location: string | null): string | null {
  if (!location) {
    return null;
  }
  const trimmed = location.trim();
  if (!trimmed || /^multiple locations$/i.test(trimmed)) {
    return trimmed || null;
  }
  return trimmed;
}

function buildL3HarrisClassificationDescription(listing: L3HarrisListing): string {
  const boost: string[] = [];
  if (
    listing.category &&
    /internship|student|university|co op/i.test(listing.category)
  ) {
    boost.push(listing.category);
  }
  if (/\bintern(?:ship)?\b/i.test(listing.title)) {
    boost.push("internship program");
  }

  return [...boost, listing.description ?? ""].filter(Boolean).join("\n");
}

function dedupeListingsByUrl(listings: L3HarrisListing[]): L3HarrisListing[] {
  const byUrl = new Map<string, L3HarrisListing>();
  for (const listing of listings) {
    byUrl.set(listing.postingUrl, listing);
  }
  return Array.from(byUrl.values());
}

