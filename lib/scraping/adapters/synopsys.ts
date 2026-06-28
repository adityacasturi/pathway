import { decodeHtmlEntities, stripHtml } from "../html-utils.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, resolveBoardToken } from "./shared.ts";

/**
 * Synopsys careers run on Radancy TalentBrew (careers.synopsys.com, org 44408).
 * Apply links use Avature; listings and detail pages are HTML on the TalentBrew site.
 */
export const SYNOPSYS_CAREERS_ORIGIN = "https://careers.synopsys.com";
export const SYNOPSYS_DEFAULT_ORG_ID = "44408";
export const SYNOPSYS_DEFAULT_SEARCH_KEYWORD = "intern";
export const SYNOPSYS_DEFAULT_SEARCH_URL = `${SYNOPSYS_CAREERS_ORIGIN}/search-jobs?k=intern&l=&listFilterMode=1`;

const SYNOPSYS_PAGE_SIZE = 15;
const SYNOPSYS_MAX_PAGES = 40;
const SYNOPSYS_DETAIL_CONCURRENCY = 6;

/** List titles must look internship-related before we fetch full descriptions. */
const INTERNSHIP_LIST_TITLE_PATTERN =
  /\bintern(?:ship|ships)?\b|\bco-?op\b|\bfellowship\b|\buniversity\b|\bapprentissage\b|\balternance\b/i;

const SYNOPSYS_LISTING_PATTERN =
  /<a class="sr-job-link" href="(\/job\/[^"]+)"[^>]*>[\s\S]*?<h2>([\s\S]*?)<\/h2>[\s\S]*?<span class="job-location">([\s\S]*?)<\/span>/gi;

export interface SynopsysBoardConfig {
  careersOrigin: string;
  orgId: string;
  searchKeyword: string;
  searchUrl: string;
}

export interface SynopsysListing {
  title: string;
  postingUrl: string;
  location: string | null;
  category: string | null;
  description?: string | null;
}

export function createSynopsysAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveSynopsysBoard(source);
  const resolvedSource =
    source.boardToken === board.searchKeyword && source.sourceUrl === board.searchUrl
      ? source
      : { ...source, boardToken: board.searchKeyword, sourceUrl: board.searchUrl };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const listings = await fetchAllSynopsysListings(board);
      const enriched = await enrichSynopsysListings(listings, board);
      return parseSynopsysJobs(enriched, resolvedSource);
    },
  };
}

export function resolveSynopsysBoard(source: CompanySourceConfig): SynopsysBoardConfig {
  const searchKeyword =
    resolveBoardToken(source, parseSynopsysSearchKeywordFromUrl) || SYNOPSYS_DEFAULT_SEARCH_KEYWORD;
  const orgId = parseSynopsysOrgIdFromUrl(source.sourceUrl) ?? SYNOPSYS_DEFAULT_ORG_ID;
  const searchUrl = normalizeSynopsysSearchUrl(source.sourceUrl, searchKeyword);

  return {
    careersOrigin: SYNOPSYS_CAREERS_ORIGIN,
    orgId,
    searchKeyword,
    searchUrl,
  };
}

export function parseSynopsysSearchJobsHtml(html: string, careersOrigin: string): SynopsysListing[] {
  const listings: SynopsysListing[] = [];

  for (const match of html.matchAll(SYNOPSYS_LISTING_PATTERN)) {
    const relativePath = decodeHtmlEntities(match[1]?.trim() ?? "");
    const title = decodeHtmlEntities(stripHtml(match[2] ?? ""));
    const location = decodeHtmlEntities(stripHtml(match[3] ?? "")) || null;
    if (!relativePath || !title || !isSynopsysJobPath(relativePath)) {
      continue;
    }

    const postingUrl = buildSynopsysPostingUrl(careersOrigin, relativePath);
    if (!postingUrl) {
      continue;
    }

    listings.push({
      title,
      postingUrl,
      location: normalizeSynopsysListLocation(location),
      category: null,
    });
  }

  return dedupeListingsByUrl(listings);
}

export function parseSynopsysJobDetailFields(html: string): {
  title: string | null;
  category: string | null;
  location: string | null;
  description: string;
} {
  const title =
    html.match(/<h1 class="ajd_header__job-title">([^<]+)/i)?.[1]?.trim() ??
    html.match(/<meta[^>]+name="job-tbcn-job-title"[^>]+content="([^"]+)"/i)?.[1]?.trim() ??
    null;

  const location = normalizeSynopsysListLocation(
    stripHtml(html.match(/<span class="ajd-job-location">([\s\S]*?)<\/span>/i)?.[1] ?? "") ||
      html.match(/<meta[^>]+name="gtm_tbcn_joblocation"[^>]+content="([^"]+)"/i)?.[1]?.trim() ||
      null,
  );

  const category =
    html.match(/<span class="ajd-job-category">([^<]+)/i)?.[1]?.trim() ??
    html.match(/<span class="job-category job-info">\s*<b>Category<\/b>\s*([^<]+)/i)?.[1]?.trim() ??
    html.match(/<meta[^>]+name="gtm_tbcn_jobcategory"[^>]+content="([^"]+)"/i)?.[1]?.trim() ??
    null;

  const descriptionBlock =
    html.match(/<div class="ats-description[^"]*">([\s\S]*?)<\/div>\s*<div class="qualifications"/i)?.[1] ??
    html.match(/<div class="ats-description[^"]*">([\s\S]*?)<\/div>\s*<\/section>/i)?.[1];
  const description = descriptionBlock ? htmlToPlainText(descriptionBlock) : "";

  return {
    title,
    category,
    location,
    description,
  };
}

export function parseSynopsysJobs(
  listings: SynopsysListing[],
  source: CompanySourceConfig,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const listing of listings) {
    if (!matchesSynopsysBrandScope(listing, source.companySlug)) {
      rejected.push({ title: listing.title, reason: "brand_scope" });
      continue;
    }

    const roleName = listing.title.trim();
    const postingUrl = listing.postingUrl.trim();
    const description = buildSynopsysClassificationDescription(listing);
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
        description: buildSynopsysClassificationDescription(listing),
      }),
    );
  }

  return buildRoleParseResult(listings.length, roles, rejected);
}

export function shouldPrefetchSynopsysDetail(
  listing: SynopsysListing,
  searchKeyword: string,
): boolean {
  if (/^intern(?:ship)?$/i.test(searchKeyword.trim())) {
    return true;
  }

  const haystack = [listing.title, listing.category, listing.location].filter(Boolean).join(" ");
  return INTERNSHIP_LIST_TITLE_PATTERN.test(haystack);
}

export function buildSynopsysSearchUrl(
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

export function buildSynopsysPostingUrl(careersOrigin: string, relativePath: string): string | null {
  const trimmed = relativePath.trim();
  if (!trimmed.startsWith("/job/") || !isSynopsysJobPath(trimmed)) {
    return null;
  }
  return `${careersOrigin.replace(/\/$/, "")}${trimmed}`;
}

export function isSynopsysJobPath(relativePath: string): boolean {
  return /\/\d+\/\d+\/?$/i.test(relativePath);
}

async function fetchAllSynopsysListings(board: SynopsysBoardConfig): Promise<SynopsysListing[]> {
  const all: SynopsysListing[] = [];
  let totalPages = 1;

  for (let page = 1; page <= SYNOPSYS_MAX_PAGES; page += 1) {
    const url = buildSynopsysSearchUrl(board.careersOrigin, board.searchKeyword, page);
    const html = await fetchSynopsysHtml(url);
    const batch = parseSynopsysSearchJobsHtml(html, board.careersOrigin);
    all.push(...batch);

    const parsedTotalPages = parseSynopsysTotalPages(html);
    if (parsedTotalPages !== null) {
      totalPages = parsedTotalPages;
    }

    if (page >= totalPages || batch.length < SYNOPSYS_PAGE_SIZE) {
      break;
    }
  }

  return dedupeListingsByUrl(all);
}

async function enrichSynopsysListings(
  listings: SynopsysListing[],
  board: SynopsysBoardConfig,
): Promise<SynopsysListing[]> {
  const targets = listings.filter((listing) => shouldPrefetchSynopsysDetail(listing, board.searchKeyword));
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
        const html = await fetchSynopsysHtml(current.postingUrl);
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
    Array.from({ length: Math.min(SYNOPSYS_DETAIL_CONCURRENCY, targets.length) }, () => worker()),
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

async function fetchSynopsysHtml(url: string): Promise<string> {
  const res = await fetchJsonWithTimeout(url, {
    headers: { accept: "text/html,application/xhtml+xml" },
  });
  if (!res.ok) {
    throw new Error(`Synopsys careers returned ${res.status} for ${url}`);
  }
  return res.text();
}

function parseSynopsysTotalPages(html: string): number | null {
  const match = html.match(/data-total-pages="(\d+)"/i);
  if (!match) {
    return null;
  }
  const parsed = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseSynopsysSearchKeywordFromUrl(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.hostname.toLowerCase() !== "careers.synopsys.com") {
      return null;
    }
    const keyword = parsed.searchParams.get("k")?.trim();
    return keyword || null;
  } catch {
    return null;
  }
}

function parseSynopsysOrgIdFromUrl(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    const match = parsed.pathname.match(/\/job\/[^/]+\/[^/]+\/(\d+)\/\d+/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function normalizeSynopsysSearchUrl(sourceUrl: string, searchKeyword: string): string {
  const trimmed = sourceUrl.trim();
  if (trimmed) {
    try {
      const parsed = new URL(trimmed);
      if (
        parsed.hostname.toLowerCase() === "careers.synopsys.com" &&
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

  return buildSynopsysSearchUrl(SYNOPSYS_CAREERS_ORIGIN, searchKeyword, 1);
}

export function matchesSynopsysBrandScope(
  listing: Pick<SynopsysListing, "title" | "category" | "description">,
  companySlug: string,
): boolean {
  const haystack = [listing.title, listing.category, listing.description].filter(Boolean).join(" ");
  const hasAnsysBrand = /\bansys\b/i.test(haystack);

  if (companySlug === "synopsys" && hasAnsysBrand) {
    return false;
  }

  return true;
}

function normalizeSynopsysListLocation(location: string | null): string | null {
  if (!location) {
    return null;
  }
  const trimmed = location.trim();
  if (!trimmed || /^multiple locations$/i.test(trimmed)) {
    return trimmed || null;
  }
  if (/^united states\b/i.test(trimmed) && /\b(off-site|remote|hybrid)\b/i.test(trimmed)) {
    return "United States";
  }
  return trimmed;
}

function buildSynopsysClassificationDescription(listing: SynopsysListing): string {
  const boost: string[] = [];
  if (listing.category && /intern|temp|university/i.test(listing.category)) {
    boost.push(listing.category);
  }
  if (/\bintern(?:ship)?\b/i.test(listing.title)) {
    boost.push("internship program");
  }

  return [...boost, listing.description ?? ""].filter(Boolean).join("\n");
}

function dedupeListingsByUrl(listings: SynopsysListing[]): SynopsysListing[] {
  const byUrl = new Map<string, SynopsysListing>();
  for (const listing of listings) {
    byUrl.set(listing.postingUrl, listing);
  }
  return Array.from(byUrl.values());
}

