import { atsPublishDate } from "../posted-date.ts";
import { decodeHtmlEntities, stripHtml } from "../html-utils.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, resolveBoardToken, safeToIsoDate } from "./shared.ts";

/**
 * Citigroup careers run on Radancy TalentBrew (jobs.citi.com, org 287).
 * Listings are HTML search pages; detail pages carry category and description in ats-description.
 */
export const CITIGROUP_CAREERS_ORIGIN = "https://jobs.citi.com";
export const CITIGROUP_DEFAULT_ORG_ID = "287";
export const CITIGROUP_DEFAULT_SEARCH_KEYWORD = "intern";
export const CITIGROUP_DEFAULT_SEARCH_URL = `${CITIGROUP_CAREERS_ORIGIN}/search-jobs?k=intern&l=&listFilterMode=1`;

const CITIGROUP_PAGE_SIZE = 15;
const CITIGROUP_MAX_PAGES = 40;
const CITIGROUP_DETAIL_CONCURRENCY = 6;

/** List titles must look internship-related before we fetch full descriptions. */
const INTERNSHIP_LIST_TITLE_PATTERN =
  /\bintern(?:ship|ships)?\b|\bco-?op\b|\bfellowship\b|\buniversity\b|\bsummer\s+analyst\b/i;

const CITIGROUP_LISTING_PATTERN =
  /<li class="sr-job-item">[\s\S]*?<a class="sr-job-item__link" href="(\/job\/[^"]+)"[^>]*>[\s\S]*?<\/a>[\s\S]*?<span class="sr-job-item__facet[^"]* sr-job-location">([^<]*)<\/span>/gi;

const CITIGROUP_TITLE_IN_ITEM_PATTERN =
  /<li class="sr-job-item">[\s\S]*?<h3 class="sr-job-item__title">\s*<a class="sr-job-item__link" href="(\/job\/[^"]+)"[^>]*>\s*([^<]+?)\s*<\/a>/gi;

export interface CitigroupBoardConfig {
  careersOrigin: string;
  orgId: string;
  searchKeyword: string;
  searchUrl: string;
}

export interface CitigroupListing {
  title: string;
  postingUrl: string;
  location: string | null;
  category: string | null;
  description?: string | null;
  datePosted?: string | null;
}

export function createCitigroupAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveCitigroupBoard(source);
  const resolvedSource =
    source.boardToken === board.searchKeyword && source.sourceUrl === board.searchUrl
      ? source
      : { ...source, boardToken: board.searchKeyword, sourceUrl: board.searchUrl };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const listings = await fetchAllCitigroupListings(board);
      const enriched = await enrichCitigroupListings(listings, board);
      return parseCitigroupJobs(enriched, resolvedSource);
    },
  };
}

export function resolveCitigroupBoard(source: CompanySourceConfig): CitigroupBoardConfig {
  const searchKeyword =
    resolveBoardToken(source, parseCitigroupSearchKeywordFromUrl) || CITIGROUP_DEFAULT_SEARCH_KEYWORD;
  const orgId = parseCitigroupOrgIdFromUrl(source.sourceUrl) ?? CITIGROUP_DEFAULT_ORG_ID;
  const searchUrl = normalizeCitigroupSearchUrl(source.sourceUrl, searchKeyword);

  return {
    careersOrigin: CITIGROUP_CAREERS_ORIGIN,
    orgId,
    searchKeyword,
    searchUrl,
  };
}

export function parseCitigroupSearchJobsHtml(html: string, careersOrigin: string): CitigroupListing[] {
  const byUrl = new Map<string, CitigroupListing>();

  for (const match of html.matchAll(CITIGROUP_TITLE_IN_ITEM_PATTERN)) {
    const relativePath = decodeHtmlEntities(match[1]?.trim() ?? "");
    const title = decodeHtmlEntities(stripHtml(match[2] ?? ""));
    if (!relativePath || !title || !isCitigroupJobPath(relativePath)) {
      continue;
    }

    const postingUrl = buildCitigroupPostingUrl(careersOrigin, relativePath);
    if (!postingUrl) {
      continue;
    }

    byUrl.set(postingUrl, {
      title,
      postingUrl,
      location: null,
      category: null,
    });
  }

  for (const match of html.matchAll(CITIGROUP_LISTING_PATTERN)) {
    const relativePath = decodeHtmlEntities(match[1]?.trim() ?? "");
    const location = decodeHtmlEntities(stripHtml(match[2] ?? "")) || null;
    if (!relativePath || !isCitigroupJobPath(relativePath)) {
      continue;
    }

    const postingUrl = buildCitigroupPostingUrl(careersOrigin, relativePath);
    if (!postingUrl) {
      continue;
    }

    const existing = byUrl.get(postingUrl);
    if (existing) {
      existing.location = normalizeCitigroupListLocation(location) ?? existing.location;
    }
  }

  return Array.from(byUrl.values());
}

export function parseCitigroupJobDetailFields(html: string): {
  title: string | null;
  category: string | null;
  location: string | null;
  description: string;
  datePosted: string | null;
} {
  const title = html.match(/<h1 class="job-title-heading">([^<]+)/i)?.[1]?.trim() ?? null;

  const category =
    html.match(/name="gtm_tbcn_jobcategory"\s+content="([^"]+)"/i)?.[1]?.trim() ??
    html.match(/data-gtm-prop="tbcn-jobcategory"\s+content="([^"]+)"/i)?.[1]?.trim() ??
    null;

  const location =
    html.match(
      /<div class="job-description__desc-job-info job-location">[\s\S]*?<p class="job-description__desc-detail">([^<]+)/i,
    )?.[1]?.trim() ?? null;

  const datePosted =
    html.match(
      /<div class="job-description__desc-job-info job-date">[\s\S]*?<p class="job-description__desc-detail">([^<]+)/i,
    )?.[1]?.trim() ?? null;

  const descriptionBlock =
    html.match(
      /<div class="ats-description">([\s\S]*?)<div class="job-description__buttons bottom"/i,
    )?.[1] ?? html.match(/<div class="ats-description">([\s\S]*?)<\/div>/i)?.[1];
  const description = descriptionBlock ? htmlToPlainText(descriptionBlock) : "";

  return {
    title,
    category,
    location,
    description,
    datePosted,
  };
}

export function parseCitigroupJobs(
  listings: CitigroupListing[],
  source: CompanySourceConfig,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const listing of listings) {
    const roleName = listing.title.trim();
    const postingUrl = listing.postingUrl.trim();
    const description = buildCitigroupClassificationDescription(listing);
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
        description: buildCitigroupClassificationDescription(listing),
        dates: atsPublishDate(safeToIsoDate(listing.datePosted)),
      }),
    );
  }

  return buildRoleParseResult(listings.length, roles, rejected);
}

export function shouldPrefetchCitigroupDetail(
  listing: CitigroupListing,
  searchKeyword: string,
): boolean {
  if (/^intern(?:ship)?$/i.test(searchKeyword.trim())) {
    return true;
  }

  const haystack = [listing.title, listing.category, listing.location].filter(Boolean).join(" ");
  return INTERNSHIP_LIST_TITLE_PATTERN.test(haystack);
}

export function buildCitigroupSearchUrl(
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

export function buildCitigroupPostingUrl(careersOrigin: string, relativePath: string): string | null {
  const trimmed = relativePath.trim();
  if (!trimmed.startsWith("/job/") || !isCitigroupJobPath(trimmed)) {
    return null;
  }
  return `${careersOrigin.replace(/\/$/, "")}${trimmed}`;
}

export function isCitigroupJobPath(relativePath: string): boolean {
  return /\/\d+\/\d+\/?$/i.test(relativePath);
}

async function fetchAllCitigroupListings(board: CitigroupBoardConfig): Promise<CitigroupListing[]> {
  const all: CitigroupListing[] = [];
  let totalPages = 1;

  for (let page = 1; page <= CITIGROUP_MAX_PAGES; page += 1) {
    const url = buildCitigroupSearchUrl(board.careersOrigin, board.searchKeyword, page);
    const html = await fetchCitigroupHtml(url);
    const batch = parseCitigroupSearchJobsHtml(html, board.careersOrigin);
    all.push(...batch);

    const parsedTotalPages = parseCitigroupTotalPages(html);
    if (parsedTotalPages !== null) {
      totalPages = parsedTotalPages;
    }

    if (page >= totalPages || batch.length < CITIGROUP_PAGE_SIZE) {
      break;
    }
  }

  return dedupeListingsByUrl(all);
}

async function enrichCitigroupListings(
  listings: CitigroupListing[],
  board: CitigroupBoardConfig,
): Promise<CitigroupListing[]> {
  const targets = listings.filter((listing) =>
    shouldPrefetchCitigroupDetail(listing, board.searchKeyword),
  );
  if (targets.length === 0) {
    return listings;
  }

  const details = new Map<string, ReturnType<typeof parseCitigroupJobDetailFields>>();
  let index = 0;

  async function worker(): Promise<void> {
    while (index < targets.length) {
      const current = targets[index];
      index += 1;
      if (!current) {
        continue;
      }
      try {
        const html = await fetchCitigroupHtml(current.postingUrl);
        details.set(current.postingUrl, parseCitigroupJobDetailFields(html));
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
    Array.from({ length: Math.min(CITIGROUP_DETAIL_CONCURRENCY, targets.length) }, () => worker()),
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

async function fetchCitigroupHtml(url: string): Promise<string> {
  const res = await fetchJsonWithTimeout(url, {
    headers: { accept: "text/html,application/xhtml+xml" },
  });
  if (!res.ok) {
    throw new Error(`Citigroup careers returned ${res.status} for ${url}`);
  }
  return res.text();
}

function parseCitigroupTotalPages(html: string): number | null {
  const match = html.match(/data-total-pages="(\d+)"/i);
  if (!match) {
    return null;
  }
  const parsed = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseCitigroupSearchKeywordFromUrl(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.hostname.toLowerCase() !== "jobs.citi.com") {
      return null;
    }
    const keyword = parsed.searchParams.get("k")?.trim();
    return keyword || null;
  } catch {
    return null;
  }
}

function parseCitigroupOrgIdFromUrl(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    const match = parsed.pathname.match(/\/job\/[^/]+\/[^/]+\/(\d+)\/\d+/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function normalizeCitigroupSearchUrl(sourceUrl: string, searchKeyword: string): string {
  const trimmed = sourceUrl.trim();
  if (trimmed) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.hostname.toLowerCase() === "jobs.citi.com" && parsed.pathname.includes("search-jobs")) {
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

  return buildCitigroupSearchUrl(CITIGROUP_CAREERS_ORIGIN, searchKeyword, 1);
}

function normalizeCitigroupListLocation(location: string | null): string | null {
  if (!location) {
    return null;
  }
  const trimmed = location.trim();
  if (!trimmed || /^multiple locations$/i.test(trimmed)) {
    return trimmed || null;
  }
  return trimmed;
}

function buildCitigroupClassificationDescription(listing: CitigroupListing): string {
  const boost: string[] = [];
  if (
    listing.category &&
    /internship|student|university|technology/i.test(listing.category)
  ) {
    boost.push(listing.category);
  }
  if (/\bintern(?:ship)?\b/i.test(listing.title)) {
    boost.push("internship program");
  }
  if (/\bsummer\s+analyst\b/i.test(listing.title)) {
    boost.push("summer analyst internship program");
  }
  if (/\bseasonal\/off[- ]?cycle\b/i.test(listing.title)) {
    boost.push("seasonal off cycle internship program");
  }

  return [...boost, listing.description ?? ""].filter(Boolean).join("\n");
}

function dedupeListingsByUrl(listings: CitigroupListing[]): CitigroupListing[] {
  const byUrl = new Map<string, CitigroupListing>();
  for (const listing of listings) {
    byUrl.set(listing.postingUrl, listing);
  }
  return Array.from(byUrl.values());
}

