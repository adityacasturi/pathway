import { atsPublishDate } from "../posted-date.ts";
import { decodeHtmlEntities } from "../html-utils.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, safeToIsoDate } from "./shared.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";

export const SEAGATE_CAREERS_ORIGIN = "https://seagatecareers.com";
export const SEAGATE_DEFAULT_SEARCH_URL = `${SEAGATE_CAREERS_ORIGIN}/search/`;
const SEAGATE_PAGE_SIZE = 10;
const SEAGATE_MAX_PAGES = 30;

/** List titles must look internship-related before we fetch full descriptions. */
export interface SeagateBoardConfig {
  careersOrigin: string;
  searchUrl: string;
  searchQuery: string;
}

export interface SeagateListJob {
  jobId: string;
  title: string;
  listUrl: string;
  location: string | null;
}

export function createSeagateAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveSeagateBoard(source);
  const resolvedSource =
    source.boardToken === board.searchQuery && source.sourceUrl === board.searchUrl
      ? source
      : { ...source, boardToken: board.searchQuery, sourceUrl: board.searchUrl };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const { listings, fetchedTotal } = await fetchAllSeagateSearchListings(board);
      const candidates = listings.filter((job) => isSeagateListCandidate(job));
      return parseSeagateJobs(candidates, resolvedSource, board, fetchedTotal);
    },
  };
}

export function resolveSeagateBoard(source: CompanySourceConfig): SeagateBoardConfig {
  const explicit = source.boardToken?.trim();
  const searchQuery = explicit && explicit.length > 0 ? explicit : "intern";
  const searchUrl = isSeagateSearchUrl(source.sourceUrl) ? source.sourceUrl.trim() : SEAGATE_DEFAULT_SEARCH_URL;

  return {
    careersOrigin: SEAGATE_CAREERS_ORIGIN,
    searchUrl,
    searchQuery,
  };
}

export function isSeagateSearchUrl(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    return parsed.hostname.toLowerCase() === "seagatecareers.com" && parsed.pathname.startsWith("/search");
  } catch {
    return false;
  }
}

export async function fetchAllSeagateSearchListings(
  board: SeagateBoardConfig,
): Promise<{ listings: SeagateListJob[]; fetchedTotal: number }> {
  const all: SeagateListJob[] = [];
  const seen = new Set<string>();
  let totalRows: number | null = null;

  for (let page = 0; page < SEAGATE_MAX_PAGES; page += 1) {
    const startrow = page * SEAGATE_PAGE_SIZE;
    const html = await fetchSeagateHtml(buildSeagateSearchUrl(board, startrow));
    if (totalRows === null) {
      totalRows = parseSeagateSearchRowCount(html);
    }

    const batch = parseSeagateSearchHtml(html, board);
    for (const job of batch) {
      if (!seen.has(job.jobId)) {
        seen.add(job.jobId);
        all.push(job);
      }
    }

    if (batch.length === 0) {
      break;
    }

    if (totalRows !== null && startrow + SEAGATE_PAGE_SIZE >= totalRows) {
      break;
    }
  }

  return { listings: all, fetchedTotal: totalRows ?? all.length };
}

export function buildSeagateSearchUrl(board: SeagateBoardConfig, startrow: number): string {
  const url = new URL(board.searchUrl);
  url.searchParams.set("q", board.searchQuery);
  url.searchParams.set("locationsearch", "");
  if (startrow > 0) {
    url.searchParams.set("startrow", String(startrow));
  }
  return url.toString();
}

export function parseSeagateSearchRowCount(html: string): number | null {
  const match = html.match(/aria-rowcount="(\d+)"/i);
  if (!match?.[1]) {
    return null;
  }
  const count = Number(match[1]);
  return Number.isFinite(count) ? count : null;
}

export function parseSeagateSearchHtml(html: string, board: SeagateBoardConfig): SeagateListJob[] {
  const jobs: SeagateListJob[] = [];
  const tilePattern =
    /<li class="job-tile[^"]*"[^>]*data-url="([^"]+)"[\s\S]*?<a class="jobTitle-link[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/a>[\s\S]*?section-location-value[^>]*>\s*([^<]*)/gi;

  for (const match of html.matchAll(tilePattern)) {
    const path = match[1]?.trim() ?? "";
    const title = decodeHtmlEntities(match[2]?.replace(/\s+/g, " ").trim() ?? "");
    const location = decodeHtmlEntities(match[3]?.replace(/\s+/g, " ").trim() ?? "") || null;
    const jobId = extractSeagateJobId(path);
    if (!path || !title || !jobId) {
      continue;
    }

    jobs.push({
      jobId,
      title,
      listUrl: `${board.careersOrigin}${path.startsWith("/") ? path : `/${path}`}`,
      location,
    });
  }

  return jobs;
}

export function extractSeagateJobId(path: string): string {
  const match = path.match(/\/(\d+)\/?(?:\?|$)/);
  return match?.[1] ?? "";
}

export function isSeagateListCandidate(job: SeagateListJob): boolean {
  const title = job.title.trim();
  if (!title) {
    return false;
  }
  if (/\binternal\b/i.test(title) && !INTERNSHIP_LIST_TITLE_PATTERN.test(title)) {
    return false;
  }
  return INTERNSHIP_LIST_TITLE_PATTERN.test(title);
}

export function parseSeagateJobDetailHtml(html: string): {
  title: string;
  description: string;
  location: string | null;
  postedOn: string | null;
} {
  const title =
    readSeagateMeta(html, "og:title")?.replace(/\s+at\s+.+$/i, "").trim() ??
    readSeagateTagText(html, "h1") ??
    "";

  const descriptionBlock = extractSeagateDescriptionBlock(html);
  const description =
    readSeagateMeta(html, "og:description") ?? htmlToPlainText(descriptionBlock).trim();

  const location = extractSeagateDetailLocation(html) ?? readSeagateMeta(html, "og:locality");

  const postedOn = readSeagateMeta(html, "article:published_time");

  return {
    title: title.trim(),
    description: description.trim(),
    location: location?.trim() || null,
    postedOn: postedOn?.trim() || null,
  };
}

export async function parseSeagateJobs(
  listings: SeagateListJob[],
  source: CompanySourceConfig,
  board: SeagateBoardConfig,
  fetchedTotal: number,
): Promise<RoleParseResult> {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const listing of listings) {
    let roleName = listing.title;
    let description = "";
    let location: string | null = listing.location;
    let datePosted: string | null = null;

    try {
      const detailHtml = await fetchSeagateHtml(listing.listUrl);
      const detail = parseSeagateJobDetailHtml(detailHtml);
      if (detail.title) {
        roleName = detail.title;
      }
      description = detail.description;
      location = detail.location ?? location;
      datePosted = safeToIsoDate(detail.postedOn);
    } catch {
      // List metadata is enough for classification when detail fetch fails.
    }

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      locations: location ? [location] : [],
    });

    if (!classification.include) {
      if (roleName) {
        rejected.push({ title: roleName, reason: classification.reason });
      }
      continue;
    }

    const postingUrl = listing.listUrl;
    if (!isHttpUrl(postingUrl)) {
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
        description: "",
        dates: atsPublishDate(datePosted),
      }),
    );
  }

  return buildRoleParseResult(fetchedTotal, roles, rejected);
}

function extractSeagateDescriptionBlock(html: string): string {
  const match = html.match(/class="jobdescription"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i);
  return match?.[1] ?? "";
}

function extractSeagateDetailLocation(html: string): string | null {
  const match = html.match(/section-location-value[^>]*>\s*([^<]+)/i);
  return match?.[1]?.trim() || null;
}

function readSeagateMeta(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+property="${escaped}"[^>]+content="([^"]*)"`, "i"),
    new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property="${escaped}"`, "i"),
    new RegExp(`<meta[^>]+name="${escaped}"[^>]+content="([^"]*)"`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtmlEntities(match[1]);
    }
  }
  return null;
}

function readSeagateTagText(html: string, tag: string): string | null {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1] ? htmlToPlainText(match[1]).trim() : null;
}

async function fetchSeagateHtml(url: string): Promise<string> {
  const res = await fetchJsonWithTimeout(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!res.ok) {
    throw new Error(`Seagate careers returned ${res.status} for ${url}`);
  }

  return res.text();
}

