import { decodeHtmlEntities, stripHtml } from "../html-utils.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, resolveBoardToken } from "./shared.ts";

/**
 * Arm careers run on Radancy TalentBrew (careers.arm.com, org 33099).
 * Listings are HTML search pages; detail pages carry JSON-LD and ats-description.
 */
export const ARM_CAREERS_ORIGIN = "https://careers.arm.com";
export const ARM_DEFAULT_ORG_ID = "33099";
export const ARM_DEFAULT_SEARCH_KEYWORD = "intern";
export const ARM_DEFAULT_SEARCH_URL = `${ARM_CAREERS_ORIGIN}/search-jobs?k=intern&l=&listFilterMode=1`;

const ARM_PAGE_SIZE = 15;
const ARM_MAX_PAGES = 40;
const ARM_DETAIL_CONCURRENCY = 6;

/** List titles must look internship-related before we fetch full descriptions. */
const INTERNSHIP_LIST_TITLE_PATTERN =
  /\bintern(?:ship|ships)?\b|\bco-?op\b|\bfellowship\b|\buniversity\b|\bgraduate\b/i;

const ARM_LISTING_PATTERN =
  /<a class="job-card__title[^"]*" href="(\/job\/[^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<span class="location">([^<]*)<\/span>[\s\S]*?<span class="category">([^<]*)<\/span>/gi;

export interface ArmBoardConfig {
  careersOrigin: string;
  orgId: string;
  searchKeyword: string;
  searchUrl: string;
}

export interface ArmListing {
  title: string;
  postingUrl: string;
  location: string | null;
  category: string | null;
  description?: string | null;
}

export function createArmAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveArmBoard(source);
  const resolvedSource =
    source.boardToken === board.searchKeyword && source.sourceUrl === board.searchUrl
      ? source
      : { ...source, boardToken: board.searchKeyword, sourceUrl: board.searchUrl };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const listings = await fetchAllArmListings(board);
      const enriched = await enrichArmListings(listings, board);
      return parseArmJobs(enriched, resolvedSource);
    },
  };
}

export function resolveArmBoard(source: CompanySourceConfig): ArmBoardConfig {
  const searchKeyword =
    resolveBoardToken(source, parseArmSearchKeywordFromUrl) || ARM_DEFAULT_SEARCH_KEYWORD;
  const orgId = parseArmOrgIdFromUrl(source.sourceUrl) ?? ARM_DEFAULT_ORG_ID;
  const searchUrl = normalizeArmSearchUrl(source.sourceUrl, searchKeyword);

  return {
    careersOrigin: ARM_CAREERS_ORIGIN,
    orgId,
    searchKeyword,
    searchUrl,
  };
}

export function parseArmSearchJobsHtml(html: string, careersOrigin: string): ArmListing[] {
  const listings: ArmListing[] = [];

  for (const match of html.matchAll(ARM_LISTING_PATTERN)) {
    const relativePath = decodeHtmlEntities(match[1]?.trim() ?? "");
    const title = decodeHtmlEntities(stripHtml(match[2] ?? ""));
    const location = decodeHtmlEntities(stripHtml(match[3] ?? "")) || null;
    const category = decodeHtmlEntities(stripHtml(match[4] ?? "")) || null;
    if (!relativePath || !title || !isArmJobPath(relativePath)) {
      continue;
    }

    const postingUrl = buildArmPostingUrl(careersOrigin, relativePath);
    if (!postingUrl) {
      continue;
    }

    listings.push({
      title,
      postingUrl,
      location: normalizeArmListLocation(location),
      category,
    });
  }

  return dedupeListingsByUrl(listings);
}

export function parseArmJobDetailFields(html: string): {
  title: string | null;
  category: string | null;
  location: string | null;
  description: string;
} {
  const title =
    html.match(/<h1 class="ajd_header__job-title[^"]*">([^<]+)/i)?.[1]?.trim() ??
    html.match(/<meta[^>]+name="job-tbcn-job-title"[^>]+content="([^"]+)"/i)?.[1]?.trim() ??
    null;

  const location =
    html.match(/<span class="job-location job-info"[^>]*>\s*<b>Location<\/b>\s*([^<]+)/i)?.[1]?.trim() ??
    null;

  const descriptionBlock = html.match(/<div class="ats-description">([\s\S]*?)<\/div>\s*<\/div>/i)?.[1];
  const description = descriptionBlock ? htmlToPlainText(descriptionBlock) : "";

  return {
    title,
    category: null,
    location,
    description,
  };
}

export function parseArmJobs(listings: ArmListing[], source: CompanySourceConfig): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const listing of listings) {
    const roleName = listing.title.trim();
    const postingUrl = listing.postingUrl.trim();
    const description = buildArmClassificationDescription(listing);
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
        description: buildArmClassificationDescription(listing),
      }),
    );
  }

  return buildRoleParseResult(listings.length, roles, rejected);
}

export function shouldPrefetchArmDetail(listing: ArmListing, searchKeyword: string): boolean {
  if (/^intern(?:ship)?$/i.test(searchKeyword.trim())) {
    return true;
  }

  const haystack = [listing.title, listing.category, listing.location].filter(Boolean).join(" ");
  return INTERNSHIP_LIST_TITLE_PATTERN.test(haystack);
}

export function buildArmSearchUrl(careersOrigin: string, searchKeyword: string, page: number): string {
  const url = new URL(`${careersOrigin.replace(/\/$/, "")}/search-jobs`);
  url.searchParams.set("k", searchKeyword);
  url.searchParams.set("l", "");
  url.searchParams.set("listFilterMode", "1");
  if (page > 1) {
    url.searchParams.set("p", String(page));
  }
  return url.toString();
}

export function buildArmPostingUrl(careersOrigin: string, relativePath: string): string | null {
  const trimmed = relativePath.trim();
  if (!trimmed.startsWith("/job/") || !isArmJobPath(trimmed)) {
    return null;
  }
  return `${careersOrigin.replace(/\/$/, "")}${trimmed}`;
}

export function isArmJobPath(relativePath: string): boolean {
  return /\/\d+\/\d+\/?$/i.test(relativePath);
}

async function fetchAllArmListings(board: ArmBoardConfig): Promise<ArmListing[]> {
  const all: ArmListing[] = [];
  let totalPages = 1;

  for (let page = 1; page <= ARM_MAX_PAGES; page += 1) {
    const url = buildArmSearchUrl(board.careersOrigin, board.searchKeyword, page);
    const html = await fetchArmHtml(url);
    const batch = parseArmSearchJobsHtml(html, board.careersOrigin);
    all.push(...batch);

    const parsedTotalPages = parseArmTotalPages(html);
    if (parsedTotalPages !== null) {
      totalPages = parsedTotalPages;
    }

    if (page >= totalPages || batch.length < ARM_PAGE_SIZE) {
      break;
    }
  }

  return dedupeListingsByUrl(all);
}

async function enrichArmListings(
  listings: ArmListing[],
  board: ArmBoardConfig,
): Promise<ArmListing[]> {
  const targets = listings.filter((listing) => shouldPrefetchArmDetail(listing, board.searchKeyword));
  if (targets.length === 0) {
    return listings;
  }

  const details = new Map<string, ReturnType<typeof parseArmJobDetailFields>>();
  let index = 0;

  async function worker(): Promise<void> {
    while (index < targets.length) {
      const current = targets[index];
      index += 1;
      if (!current) {
        continue;
      }
      try {
        const html = await fetchArmHtml(current.postingUrl);
        details.set(current.postingUrl, parseArmJobDetailFields(html));
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
    Array.from({ length: Math.min(ARM_DETAIL_CONCURRENCY, targets.length) }, () => worker()),
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

async function fetchArmHtml(url: string): Promise<string> {
  const res = await fetchJsonWithTimeout(url, {
    headers: { accept: "text/html,application/xhtml+xml" },
  });
  if (!res.ok) {
    throw new Error(`Arm careers returned ${res.status} for ${url}`);
  }
  return res.text();
}

function parseArmTotalPages(html: string): number | null {
  const match = html.match(/data-total-pages="(\d+)"/i);
  if (!match) {
    return null;
  }
  const parsed = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseArmSearchKeywordFromUrl(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.hostname.toLowerCase() !== "careers.arm.com") {
      return null;
    }
    const keyword = parsed.searchParams.get("k")?.trim();
    return keyword || null;
  } catch {
    return null;
  }
}

function parseArmOrgIdFromUrl(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    const match = parsed.pathname.match(/\/job\/[^/]+\/[^/]+\/(\d+)\/\d+/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function normalizeArmSearchUrl(sourceUrl: string, searchKeyword: string): string {
  const trimmed = sourceUrl.trim();
  if (trimmed) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.hostname.toLowerCase() === "careers.arm.com" && parsed.pathname.includes("search-jobs")) {
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

  return buildArmSearchUrl(ARM_CAREERS_ORIGIN, searchKeyword, 1);
}

function normalizeArmListLocation(location: string | null): string | null {
  if (!location) {
    return null;
  }
  const trimmed = location.trim();
  if (!trimmed || /^multiple locations$/i.test(trimmed)) {
    return trimmed || null;
  }
  return trimmed;
}

function buildArmClassificationDescription(listing: ArmListing): string {
  const boost: string[] = [];
  if (listing.category && /internship|student|university|graduate/i.test(listing.category)) {
    boost.push(listing.category);
  }
  if (/\bintern(?:ship)?\b/i.test(listing.title)) {
    boost.push("internship program");
  }

  return [...boost, listing.description ?? ""].filter(Boolean).join("\n");
}

function dedupeListingsByUrl(listings: ArmListing[]): ArmListing[] {
  const byUrl = new Map<string, ArmListing>();
  for (const listing of listings) {
    byUrl.set(listing.postingUrl, listing);
  }
  return Array.from(byUrl.values());
}

