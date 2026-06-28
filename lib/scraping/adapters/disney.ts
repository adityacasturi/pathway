import { decodeHtmlEntities, stripHtml } from "../html-utils.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";
import { parseSynopsysJobDetailFields } from "./synopsys.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, resolveBoardToken } from "./shared.ts";

/**
 * Disney careers moved to Radancy TalentBrew on www.disneycareers.com (org 391).
 * The legacy jobs.disneycareers.com host redirects to the homepage and no longer SSRs listings.
 */
export const DISNEY_CAREERS_ORIGIN = "https://www.disneycareers.com";
export const DISNEY_DEFAULT_ORG_ID = "391";
export const DISNEY_DEFAULT_SEARCH_KEYWORD = "intern";
export const DISNEY_DEFAULT_SEARCH_URL = `${DISNEY_CAREERS_ORIGIN}/en/search-jobs?k=intern`;

const DISNEY_PAGE_SIZE = 10;
const DISNEY_MAX_PAGES = 40;
const DISNEY_DETAIL_CONCURRENCY = 6;

const DISNEY_LISTING_PATTERN =
  /<a href="(\/en\/job\/[^"]+)"[^>]*>[\s\S]*?<h2>([\s\S]*?)<\/h2>[\s\S]*?<span class="job-location">([\s\S]*?)<\/span>/gi;

export interface DisneyBoardConfig {
  careersOrigin: string;
  orgId: string;
  searchKeyword: string;
  searchUrl: string;
}

export interface DisneyListing {
  title: string;
  postingUrl: string;
  location: string | null;
  category: string | null;
  description?: string | null;
}

export function createDisneyAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveDisneyBoard(source);
  const resolvedSource =
    source.boardToken === board.searchKeyword && source.sourceUrl === board.searchUrl
      ? source
      : { ...source, boardToken: board.searchKeyword, sourceUrl: board.searchUrl };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const listings = await fetchAllDisneyListings(board);
      const enriched = await enrichDisneyListings(listings, board);
      return parseDisneyJobs(enriched, resolvedSource);
    },
  };
}

export function resolveDisneyBoard(source: CompanySourceConfig): DisneyBoardConfig {
  const searchKeyword =
    resolveBoardToken(source, parseDisneySearchKeywordFromUrl) || DISNEY_DEFAULT_SEARCH_KEYWORD;
  const orgId = parseDisneyOrgIdFromUrl(source.sourceUrl) ?? DISNEY_DEFAULT_ORG_ID;
  const searchUrl = normalizeDisneySearchUrl(source.sourceUrl, searchKeyword);

  return {
    careersOrigin: DISNEY_CAREERS_ORIGIN,
    orgId,
    searchKeyword,
    searchUrl,
  };
}

export function parseDisneySearchJobsHtml(html: string, careersOrigin: string): DisneyListing[] {
  const listings: DisneyListing[] = [];

  for (const match of html.matchAll(DISNEY_LISTING_PATTERN)) {
    const relativePath = decodeHtmlEntities(match[1]?.trim() ?? "");
    const title = decodeHtmlEntities(stripHtml(match[2] ?? ""));
    const location = decodeHtmlEntities(stripHtml(match[3] ?? "")) || null;
    if (!relativePath || !title || !isDisneyJobPath(relativePath)) {
      continue;
    }

    const postingUrl = buildDisneyPostingUrl(careersOrigin, relativePath);
    if (!postingUrl) {
      continue;
    }

    listings.push({
      title,
      postingUrl,
      location: normalizeDisneyListLocation(location),
      category: null,
    });
  }

  return dedupeListingsByUrl(listings);
}

export function parseDisneyJobs(
  listings: DisneyListing[],
  source: CompanySourceConfig,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const listing of listings) {
    const roleName = listing.title.trim();
    const postingUrl = listing.postingUrl.trim();
    const description = buildDisneyClassificationDescription(listing);
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
      }),
    );
  }

  return buildRoleParseResult(listings.length, roles, rejected);
}

export function buildDisneySearchUrl(
  careersOrigin: string,
  searchKeyword: string,
  page: number,
): string {
  const url = new URL(`${careersOrigin.replace(/\/$/, "")}/en/search-jobs`);
  url.searchParams.set("k", searchKeyword);
  if (page > 1) {
    url.searchParams.set("p", String(page));
  }
  return url.toString();
}

export function buildDisneyPostingUrl(careersOrigin: string, relativePath: string): string | null {
  const trimmed = relativePath.trim();
  if (!trimmed.startsWith("/en/job/") || !isDisneyJobPath(trimmed)) {
    return null;
  }
  return `${careersOrigin.replace(/\/$/, "")}${trimmed}`;
}

export function isDisneyJobPath(relativePath: string): boolean {
  return /\/\d+\/\d+\/?$/i.test(relativePath);
}

async function fetchAllDisneyListings(board: DisneyBoardConfig): Promise<DisneyListing[]> {
  const all: DisneyListing[] = [];
  let totalPages = 1;

  for (let page = 1; page <= DISNEY_MAX_PAGES; page += 1) {
    const url = buildDisneySearchUrl(board.careersOrigin, board.searchKeyword, page);
    const html = await fetchDisneyHtml(url);
    const batch = parseDisneySearchJobsHtml(html, board.careersOrigin);
    all.push(...batch);

    const parsedTotalPages = parseDisneyTotalPages(html);
    if (parsedTotalPages !== null) {
      totalPages = parsedTotalPages;
    }

    if (page >= totalPages || batch.length < DISNEY_PAGE_SIZE) {
      break;
    }
  }

  return dedupeListingsByUrl(all);
}

async function enrichDisneyListings(
  listings: DisneyListing[],
  board: DisneyBoardConfig,
): Promise<DisneyListing[]> {
  const targets = listings.filter((listing) => shouldPrefetchDisneyDetail(listing, board.searchKeyword));
  if (targets.length === 0) {
    return listings;
  }

  const details = new Map<string, ReturnType<typeof parseSynopsysJobDetailFields>>();
  let index = 0;

  async function worker(): Promise<void> {
    while (index < targets.length) {
      const current = targets[index];
      index += 1;
      if (!current) {
        continue;
      }
      try {
        const html = await fetchDisneyHtml(current.postingUrl);
        details.set(current.postingUrl, parseSynopsysJobDetailFields(html));
      } catch {
        details.set(current.postingUrl, {
          title: null,
          category: null,
          location: null,
          description: "",
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(DISNEY_DETAIL_CONCURRENCY, targets.length) }, () => worker()),
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
    };
  });
}

function shouldPrefetchDisneyDetail(listing: DisneyListing, searchKeyword: string): boolean {
  if (/^intern(?:ship)?$/i.test(searchKeyword.trim())) {
    return true;
  }

  const haystack = [listing.title, listing.category, listing.location].filter(Boolean).join(" ");
  return INTERNSHIP_LIST_TITLE_PATTERN.test(haystack);
}

async function fetchDisneyHtml(url: string): Promise<string> {
  const res = await fetchJsonWithTimeout(url, {
    headers: { accept: "text/html,application/xhtml+xml" },
  });
  if (!res.ok) {
    throw new Error(`Disney careers returned ${res.status} for ${url}`);
  }
  return res.text();
}

function parseDisneyTotalPages(html: string): number | null {
  const match = html.match(/data-total-pages="(\d+)"/i);
  if (!match) {
    return null;
  }
  const parsed = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseDisneySearchKeywordFromUrl(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    if (!isDisneyCareersHost(parsed.hostname)) {
      return null;
    }
    const keyword = parsed.searchParams.get("k")?.trim();
    return keyword || null;
  } catch {
    return null;
  }
}

function parseDisneyOrgIdFromUrl(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    const match = parsed.pathname.match(/\/job\/[^/]+\/[^/]+\/(\d+)\/\d+/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function normalizeDisneySearchUrl(sourceUrl: string, searchKeyword: string): string {
  const trimmed = sourceUrl.trim();
  if (trimmed) {
    try {
      const parsed = new URL(trimmed);
      if (isDisneyCareersHost(parsed.hostname) && parsed.pathname.includes("search-jobs")) {
        parsed.searchParams.set("k", searchKeyword);
        parsed.searchParams.delete("p");
        return parsed.toString();
      }
    } catch {
      // fall through
    }
  }

  return buildDisneySearchUrl(DISNEY_CAREERS_ORIGIN, searchKeyword, 1);
}

function isDisneyCareersHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "www.disneycareers.com" || host === "disneycareers.com";
}

function normalizeDisneyListLocation(location: string | null): string | null {
  if (!location) {
    return null;
  }
  const trimmed = location.trim();
  if (!trimmed || /^multiple locations$/i.test(trimmed)) {
    return trimmed || null;
  }
  return trimmed;
}

function buildDisneyClassificationDescription(listing: DisneyListing): string {
  return [listing.title, listing.category, listing.location, listing.description]
    .filter(Boolean)
    .join("\n");
}

function dedupeListingsByUrl(listings: DisneyListing[]): DisneyListing[] {
  const seen = new Set<string>();
  const deduped: DisneyListing[] = [];
  for (const listing of listings) {
    if (seen.has(listing.postingUrl)) {
      continue;
    }
    seen.add(listing.postingUrl);
    deduped.push(listing);
  }
  return deduped;
}
