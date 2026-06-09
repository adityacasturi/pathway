import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, scraperDelay } from "./shared.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";

/**
 * BAE Systems US careers use Phenom People (jobs.baesystems.com) with BrassRing apply URLs.
 * Job lists are embedded in search-results HTML as eagerLoadRefineSearch DDO JSON.
 */
export const BAE_SYSTEMS_CAREERS_ORIGIN = "https://jobs.baesystems.com";
export const BAE_SYSTEMS_DEFAULT_SEARCH_URL = `${BAE_SYSTEMS_CAREERS_ORIGIN}/global/en/search-results?keywords=intern`;

const BAE_SYSTEMS_SEARCH_KEYWORDS = [
  "intern",
  "internship",
  "co-op",
  "university",
  "summer intern",
] as const;

const BAE_SYSTEMS_PAGE_SIZE = 20;
const BAE_SYSTEMS_MAX_PAGES_PER_KEYWORD = 12;
const BAE_SYSTEMS_REQUEST_DELAY_MS = 200;

/** List titles must look internship-related before we classify. */
const EAGER_LOAD_REFINE_SEARCH_KEY = '"eagerLoadRefineSearch":';

export interface BaeSystemsBoardConfig {
  careersOrigin: string;
  searchKeywords: string[];
}

export interface BaeSystemsJobSummary {
  jobId?: string;
  title?: string;
  location?: string;
  country?: string;
  cityState?: string;
  multi_location?: string[];
  applyUrl?: string;
  descriptionTeaser?: string;
  postedDate?: string;
  category?: string;
}

interface BaeSystemsSearchDdo {
  totalHits?: number;
  hits?: number;
  data?: {
    jobs?: BaeSystemsJobSummary[];
  };
}

interface BaeSystemsJobDetailDdo {
  data?: {
    job?: {
      title?: string;
      description?: string;
      descriptionTeaser?: string;
      location?: string;
      country?: string;
      cityState?: string;
      multi_location?: string[];
      applyUrl?: string;
      postedDate?: string;
      category?: string;
    };
  };
}

export function createBaeSystemsAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveBaeSystemsBoard(source);
  const resolvedSource =
    source.sourceUrl === board.careersOrigin || source.sourceUrl.includes("jobs.baesystems.com")
      ? source
      : { ...source, sourceUrl: BAE_SYSTEMS_DEFAULT_SEARCH_URL };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const summaries = await fetchAllBaeSystemsSummaries(board);
      const candidates = summaries.filter(isBaeSystemsListCandidate);
      const enriched = await enrichBaeSystemsSummaries(candidates);
      return parseBaeSystemsJobs(enriched, resolvedSource, summaries.length);
    },
  };
}

export function resolveBaeSystemsBoard(source: CompanySourceConfig): BaeSystemsBoardConfig {
  const careersOrigin = parseBaeSystemsCareersOrigin(source.sourceUrl) ?? BAE_SYSTEMS_CAREERS_ORIGIN;
  const fromUrl = parseBaeSystemsSearchKeywordFromUrl(source.sourceUrl);
  const searchKeywords = fromUrl
    ? [fromUrl, ...BAE_SYSTEMS_SEARCH_KEYWORDS.filter((keyword) => keyword !== fromUrl)]
    : [...BAE_SYSTEMS_SEARCH_KEYWORDS];

  return { careersOrigin, searchKeywords };
}

export function parseBaeSystemsSearchDdo(html: string): BaeSystemsSearchDdo | null {
  const jsonText = extractBaeSystemsDdoJson(html, EAGER_LOAD_REFINE_SEARCH_KEY);
  if (!jsonText) {
    return null;
  }

  try {
    return JSON.parse(jsonText) as BaeSystemsSearchDdo;
  } catch {
    throw new Error("BAE Systems careers search DDO was not valid JSON");
  }
}

export function parseBaeSystemsJobDetailDdo(html: string): BaeSystemsJobDetailDdo | null {
  const jsonText = extractBaeSystemsDdoJson(html, '"jobDetail":');
  if (!jsonText) {
    return null;
  }

  try {
    return JSON.parse(jsonText) as BaeSystemsJobDetailDdo;
  } catch {
    return null;
  }
}

export function buildBaeSystemsSearchUrl(
  board: BaeSystemsBoardConfig,
  keyword: string,
  offset = 0,
): string {
  const url = new URL(`${board.careersOrigin}/global/en/search-results`);
  url.searchParams.set("keywords", keyword.trim());
  if (offset > 0) {
    url.searchParams.set("from", String(offset));
    url.searchParams.set("s", "1");
  }
  return url.toString();
}

export function buildBaeSystemsPostingUrl(summary: BaeSystemsJobSummary): string | null {
  const applyUrl = summary.applyUrl?.trim();
  if (applyUrl && isHttpUrl(applyUrl)) {
    return applyUrl;
  }
  return null;
}

export function formatBaeSystemsLocations(summary: BaeSystemsJobSummary): string[] {
  const multi = (summary.multi_location ?? []).map((location) => location.trim()).filter(Boolean);
  if (multi.length > 0) {
    return Array.from(new Set(multi));
  }

  const primary = summary.location?.trim() || summary.cityState?.trim() || "";
  if (primary) {
    return [primary];
  }

  const country = summary.country?.trim();
  return country ? [country] : [];
}

export function isBaeSystemsListCandidate(summary: BaeSystemsJobSummary): boolean {
  const haystack = [summary.title, summary.category, summary.descriptionTeaser]
    .filter(Boolean)
    .join(" ");
  return INTERNSHIP_LIST_TITLE_PATTERN.test(haystack);
}

export function parseBaeSystemsJobs(
  postings: Array<{ summary: BaeSystemsJobSummary; description: string }>,
  source: CompanySourceConfig,
  fetchedTotal: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const posting of postings) {
    const summary = posting.summary;
    const roleName = summary.title?.trim() ?? "";
    const locations = formatBaeSystemsLocations(summary);
    const postingUrl = buildBaeSystemsPostingUrl(summary);

    const classification = classifyForSource(source, {
      title: roleName,
      description: posting.description,
      departments: summary.category ? [summary.category] : [],
      locations,
    });

    if (!classification.include) {
      if (roleName) {
        rejected.push({ title: roleName, reason: classification.reason });
      }
      continue;
    }

    if (!postingUrl) {
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
      }),
    );
  }

  return buildRoleParseResult(fetchedTotal, roles, rejected);
}

async function fetchAllBaeSystemsSummaries(board: BaeSystemsBoardConfig): Promise<BaeSystemsJobSummary[]> {
  const byJobId = new Map<string, BaeSystemsJobSummary>();

  for (const keyword of board.searchKeywords) {
    const batch = await fetchBaeSystemsKeywordSummaries(board, keyword);
    for (const summary of batch) {
      const key = summary.jobId?.trim() || summary.applyUrl?.trim() || summary.title?.trim();
      if (key) {
        byJobId.set(key, summary);
      }
    }
    await scraperDelay(BAE_SYSTEMS_REQUEST_DELAY_MS);
  }

  return Array.from(byJobId.values());
}

async function fetchBaeSystemsKeywordSummaries(
  board: BaeSystemsBoardConfig,
  keyword: string,
): Promise<BaeSystemsJobSummary[]> {
  const merged: BaeSystemsJobSummary[] = [];
  let offset = 0;
  let totalHits = Number.POSITIVE_INFINITY;

  for (let page = 0; page < BAE_SYSTEMS_MAX_PAGES_PER_KEYWORD; page += 1) {
    const url = buildBaeSystemsSearchUrl(board, keyword, offset);
    const html = await fetchBaeSystemsHtml(url);
    const ddo = parseBaeSystemsSearchDdo(html);
    const jobs = ddo?.data?.jobs ?? [];

    if (page === 0 && typeof ddo?.totalHits === "number") {
      totalHits = ddo.totalHits;
    }

    merged.push(...jobs);

    offset += BAE_SYSTEMS_PAGE_SIZE;
    if (jobs.length === 0 || offset >= totalHits) {
      break;
    }

    await scraperDelay(BAE_SYSTEMS_REQUEST_DELAY_MS);
  }

  return merged;
}

async function enrichBaeSystemsSummaries(
  summaries: BaeSystemsJobSummary[],
): Promise<Array<{ summary: BaeSystemsJobSummary; description: string }>> {
  return summaries.map((summary) => ({
    summary,
    description: buildBaeSystemsDescription(summary),
  }));
}

function buildBaeSystemsDescription(summary: BaeSystemsJobSummary): string {
  const teaser = summary.descriptionTeaser?.trim() ?? "";
  const locations = formatBaeSystemsLocations(summary).join(" ");
  return [teaser, locations, summary.country?.trim()].filter(Boolean).join("\n");
}

function extractBaeSystemsDdoJson(html: string, marker: string): string | null {
  const start = html.indexOf(marker);
  if (start < 0) {
    return null;
  }

  const jsonStart = html.indexOf("{", start + marker.length);
  if (jsonStart < 0) {
    return null;
  }

  let depth = 0;
  for (let index = jsonStart; index < html.length; index += 1) {
    const char = html[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return html.slice(jsonStart, index + 1);
      }
    }
  }

  return null;
}

function parseBaeSystemsCareersOrigin(sourceUrl: string): string | null {
  try {
    const hostname = new URL(sourceUrl).hostname.toLowerCase();
    if (hostname === "jobs.baesystems.com" || hostname.endsWith(".baesystems.com")) {
      return BAE_SYSTEMS_CAREERS_ORIGIN;
    }
    return null;
  } catch {
    return null;
  }
}

function parseBaeSystemsSearchKeywordFromUrl(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    return parsed.searchParams.get("keywords")?.trim() || null;
  } catch {
    return null;
  }
}

async function fetchBaeSystemsHtml(url: string): Promise<string> {
  const res = await fetchJsonWithTimeout(url, {
    headers: { accept: "text/html,application/xhtml+xml" },
  });
  if (!res.ok) {
    throw new Error(`BAE Systems careers returned ${res.status} for ${url}`);
  }
  return res.text();
}

