import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, safeToIsoDate, scraperDelay } from "./shared.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";

/** Public JSON search API on amazon.jobs (locale path segment, e.g. /en/search.json). */
export const AMAZON_CAREERS_ORIGIN = "https://www.amazon.jobs";
export const AMAZON_DEFAULT_LOCALE = "en";
export const AMAZON_DEFAULT_SEARCH_QUERY = "intern";
export const AMAZON_LOC_QUERY = "United States";
export const AMAZON_COUNTRY_CODE = "USA";

const AMAZON_PAGE_SIZE = 100;
const AMAZON_MAX_PAGES = 20;
const AMAZON_REQUEST_DELAY_MS = 300;

export interface AmazonBoardConfig {
  locale: string;
  careersOrigin: string;
  searchBaseUrl: string;
  searchQuery: string;
}

export interface AmazonJob {
  id_icims?: string | number;
  title?: string;
  job_path?: string;
  description?: string;
  description_short?: string;
  basic_qualifications?: string;
  preferred_qualifications?: string;
  city?: string;
  state?: string;
  country_code?: string;
  location?: string;
  locations?: string[];
  job_category?: string;
  job_family?: string;
  posted_date?: string;
  is_intern?: boolean | null;
  business_category?: string;
}

export interface AmazonSearchResponse {
  hits?: number;
  jobs?: AmazonJob[];
  error?: string | null;
}

interface AmazonLocationJson {
  normalizedLocation?: string;
  locationNonStemming?: string;
  location?: string;
  normalizedCountryCode?: string;
}

export function createAmazonAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveAmazonBoard(source);
  const resolvedSource =
    source.boardToken === board.locale ? source : { ...source, boardToken: board.locale };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const jobs = await fetchAllAmazonJobs(board);
      const candidates = jobs.filter((job) => isAmazonListCandidate(job));
      return parseAmazonJobs(candidates, resolvedSource, board, jobs.length);
    },
  };
}

export function resolveAmazonBoard(source: CompanySourceConfig): AmazonBoardConfig {
  const locale = normalizeAmazonLocale(source.boardToken) ?? parseAmazonLocaleFromUrl(source.sourceUrl) ?? AMAZON_DEFAULT_LOCALE;

  return {
    locale,
    careersOrigin: AMAZON_CAREERS_ORIGIN,
    searchBaseUrl: `${AMAZON_CAREERS_ORIGIN}/${locale}/search.json`,
    searchQuery: AMAZON_DEFAULT_SEARCH_QUERY,
  };
}

export function buildAmazonPostingUrl(board: AmazonBoardConfig, job: AmazonJob): string | null {
  const path = job.job_path?.trim();
  if (!path) {
    return null;
  }

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${board.careersOrigin}${path.startsWith("/") ? path : `/${path}`}`;
}

export function formatAmazonLocations(job: AmazonJob): string[] {
  const labels: string[] = [];

  for (const raw of job.locations ?? []) {
    if (typeof raw !== "string") {
      continue;
    }

    try {
      const parsed = JSON.parse(raw) as AmazonLocationJson;
      const label =
        parsed.normalizedLocation?.trim() ||
        parsed.locationNonStemming?.trim() ||
        parsed.location?.trim();
      if (label) {
        labels.push(label);
      }
    } catch {
      // ignore malformed location blobs
    }
  }

  if (labels.length > 0) {
    return Array.from(new Set(labels));
  }

  const primary = job.location?.trim();
  if (primary) {
    return [primary];
  }

  const city = job.city?.trim();
  const state = job.state?.trim();
  if (city && state) {
    return [`${city}, ${state}, US`];
  }

  if (city) {
    return [city];
  }

  return [];
}

export function parseAmazonPostedDate(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  const parsed = new Date(`${normalized} UTC`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return safeToIsoDate(parsed);
}

export function parseAmazonJobs(
  jobs: AmazonJob[],
  source: CompanySourceConfig,
  board: AmazonBoardConfig,
  fetchedTotal: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const job of jobs) {
    const roleName = job.title?.trim() || "";
    const description = amazonJobDescription(job);
    const locations = formatAmazonLocations(job);
    const postingUrl = buildAmazonPostingUrl(board, job);

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      team: job.job_family?.trim() || job.job_category?.trim() || null,
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
        description: amazonJobDescription(job),
      }),
    );
  }

  return buildRoleParseResult(fetchedTotal, roles, rejected);
}

export function parseAmazonSearchResponse(payload: unknown, url: string): AmazonJob[] {
  if (!payload || typeof payload !== "object") {
    throw new Error(`Amazon search response was not JSON for ${url}`);
  }

  const response = payload as AmazonSearchResponse;
  if (response.error) {
    throw new Error(`Amazon search returned error for ${url}: ${response.error}`);
  }

  if (!Array.isArray(response.jobs)) {
    throw new Error(`Amazon search response was not in expected format for ${url}`);
  }

  return response.jobs;
}

async function fetchAllAmazonJobs(board: AmazonBoardConfig): Promise<AmazonJob[]> {
  const jobs: AmazonJob[] = [];
  let offset = 0;

  for (let page = 0; page < AMAZON_MAX_PAGES; page++) {
    const batch = await fetchAmazonSearchPage(board, offset);
    if (batch.length === 0) {
      break;
    }

    jobs.push(...batch);
    offset += batch.length;

    if (batch.length < AMAZON_PAGE_SIZE) {
      break;
    }

    await scraperDelay(AMAZON_REQUEST_DELAY_MS);
  }

  return jobs;
}

async function fetchAmazonSearchPage(board: AmazonBoardConfig, offset: number): Promise<AmazonJob[]> {
  const url = new URL(board.searchBaseUrl);
  url.searchParams.set("base_query", board.searchQuery);
  url.searchParams.set("loc_query", AMAZON_LOC_QUERY);
  url.searchParams.set("country", AMAZON_COUNTRY_CODE);
  url.searchParams.set("result_limit", String(AMAZON_PAGE_SIZE));
  url.searchParams.set("offset", String(offset));

  const res = await fetchJsonWithTimeout(url.toString());
  if (!res.ok) {
    throw new Error(`Amazon search returned ${res.status} for ${url.toString()}`);
  }

  const payload = (await res.json()) as unknown;
  return parseAmazonSearchResponse(payload, url.toString());
}

function isAmazonListCandidate(job: AmazonJob): boolean {
  const country = job.country_code?.trim().toUpperCase();
  if (country && country !== AMAZON_COUNTRY_CODE) {
    return false;
  }

  const title = job.title?.trim() ?? "";
  if (INTERNSHIP_LIST_TITLE_PATTERN.test(title)) {
    return true;
  }

  if (job.is_intern === true) {
    return true;
  }

  return job.business_category?.trim().toLowerCase() === "studentprograms";
}

function amazonJobDescription(job: AmazonJob): string {
  const parts = [
    job.description,
    job.description_short,
    job.basic_qualifications,
    job.preferred_qualifications,
  ]
    .map((part) => (part ? htmlToPlainText(part) : ""))
    .filter(Boolean);

  return parts.join("\n\n");
}

function normalizeAmazonLocale(boardToken: string | null | undefined): string | null {
  if (!boardToken) {
    return null;
  }

  const trimmed = boardToken.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function parseAmazonLocaleFromUrl(sourceUrl: string | null | undefined): string | null {
  if (!sourceUrl?.trim()) {
    return null;
  }

  try {
    const parsed = new URL(sourceUrl);
    if (parsed.hostname.toLowerCase() !== "www.amazon.jobs" && parsed.hostname.toLowerCase() !== "amazon.jobs") {
      return null;
    }

    const segment = parsed.pathname
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean)[0];
    return segment || null;
  } catch {
    return null;
  }
}

