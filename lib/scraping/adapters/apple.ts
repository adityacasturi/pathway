import { slugifyPostingTitle } from "../html-utils.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchWithTimeout, isHttpUrl } from "./shared.ts";

const APPLE_PAGE_SIZE = 20;
const APPLE_MAX_PAGES = 40;
const APPLE_SEARCH_QUERY = "intern";
const HYDRATION_MARKER = "__staticRouterHydrationData";

const SCRAPER_USER_AGENT = "Pathway internship tracker scraper (+https://pathway.app)";

export interface AppleSearchConfig {
  locale: string;
  locationSlug: string;
  searchQuery: string;
}

interface AppleLocation {
  postLocationId?: string;
  city?: string;
  stateProvince?: string;
  countryName?: string;
  metro?: string;
  region?: string;
  name?: string;
}

interface AppleTeam {
  teamName?: string;
  teamID?: string;
  teamCode?: string;
}

export interface AppleJobPosting {
  id: string;
  reqId?: string;
  positionId?: string;
  postingTitle?: string;
  transformedPostingTitle?: string;
  jobSummary?: string;
  locations?: AppleLocation[];
  postDateInGMT?: string;
  postingDate?: string;
  team?: AppleTeam;
  standardWeeklyHours?: number;
}

interface AppleSearchLoaderData {
  searchResults?: AppleJobPosting[];
  totalRecords?: number;
  page?: number;
}

interface AppleHydrationPayload {
  loaderData?: {
    search?: AppleSearchLoaderData;
  };
}

export function createAppleAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const config = parseAppleSearchConfig(source.sourceUrl, source.boardToken);
  const resolvedSource =
    source.boardToken === config.locale ? source : { ...source, boardToken: config.locale };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const jobs = await fetchAllAppleSearchResults(config);
      return parseAppleJobs(jobs, resolvedSource, config, jobs.length);
    },
  };
}

export function parseAppleSearchConfig(
  sourceUrl: string,
  boardToken?: string | null,
): AppleSearchConfig {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    throw new Error(`Invalid Apple careers URL: ${sourceUrl}`);
  }

  if (parsed.hostname.toLowerCase() !== "jobs.apple.com") {
    throw new Error(`Not an Apple careers host: ${parsed.hostname}`);
  }

  const pathLocale = parsed.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)[0];
  const locale = (boardToken?.trim() || pathLocale || "en-us").toLowerCase();

  const locationSlug =
    parsed.searchParams.get("location")?.trim() || "united-states-USA";
  const searchQuery = parsed.searchParams.get("search")?.trim() || APPLE_SEARCH_QUERY;

  return { locale, locationSlug, searchQuery };
}

export function buildAppleSearchPageUrl(config: AppleSearchConfig, page: number): string {
  const url = new URL(`https://jobs.apple.com/${config.locale}/search`);
  url.searchParams.set("location", config.locationSlug);
  url.searchParams.set("search", config.searchQuery);
  if (page > 1) {
    url.searchParams.set("page", String(page));
  }
  return url.toString();
}

export function buildApplePostingUrl(config: AppleSearchConfig, job: AppleJobPosting): string {
  const reqId = job.reqId?.trim() || job.id.trim();
  const slug =
    job.transformedPostingTitle?.trim() ||
    slugifyPostingTitle(job.postingTitle?.trim() || "role");
  const base = `https://jobs.apple.com/${config.locale}/details/${reqId}/${slug}`;
  const teamCode = job.team?.teamCode?.trim();
  if (!teamCode) {
    return base;
  }
  const url = new URL(base);
  url.searchParams.set("team", teamCode);
  return url.toString();
}

export function formatAppleLocations(job: AppleJobPosting): string[] {
  const locations: string[] = [];
  for (const location of job.locations ?? []) {
    const parts = [
      location.city?.trim(),
      location.metro?.trim(),
      location.stateProvince?.trim(),
      location.name?.trim(),
      location.countryName?.trim(),
    ].filter(Boolean);
    const label = Array.from(new Set(parts)).join(", ");
    if (label) {
      locations.push(label);
    }
  }
  return Array.from(new Set(locations));
}

export function parseAppleHydrationPayload(html: string): AppleSearchLoaderData {
  const markerIndex = html.indexOf(HYDRATION_MARKER);
  if (markerIndex < 0) {
    throw new Error("Apple search page did not include hydration data");
  }

  const parsePrefix = `${HYDRATION_MARKER} = JSON.parse(`;
  const start = html.indexOf(parsePrefix, markerIndex);
  if (start < 0) {
    throw new Error("Apple hydration payload was not in expected JSON.parse format");
  }

  let index = start + parsePrefix.length;
  if (html[index] !== '"') {
    throw new Error("Apple hydration payload was not a JSON string literal");
  }
  index += 1;

  let escaped = "";
  let escapedChar = false;
  for (; index < html.length; index += 1) {
    const char = html[index];
    if (escapedChar) {
      escaped += char;
      escapedChar = false;
      continue;
    }
    if (char === "\\") {
      escapedChar = true;
      continue;
    }
    if (char === '"') {
      break;
    }
    escaped += char;
  }

  const payload = JSON.parse(escaped) as AppleHydrationPayload;
  const search = payload.loaderData?.search;
  if (!search?.searchResults) {
    throw new Error("Apple hydration payload did not include search results");
  }
  return search;
}

export function parseAppleJobs(
  jobs: AppleJobPosting[],
  source: CompanySourceConfig,
  config: AppleSearchConfig,
  fetchedTotal: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const job of jobs) {
    const roleName = job.postingTitle?.trim() || "";
    const description = job.jobSummary?.trim() || "";
    const locations = formatAppleLocations(job);
    const postingUrl = buildApplePostingUrl(config, job);

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      commitment:
        typeof job.standardWeeklyHours === "number" && job.standardWeeklyHours < 40
          ? "Part Time"
          : null,
      team: job.team?.teamName ?? null,
      locations,
    });

    if (!classification.include) {
      if (roleName) {
        rejected.push({ title: roleName, reason: classification.reason });
      }
      continue;
    }

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
        description: job.jobSummary?.trim() || "",
      }),
    );
  }

  return buildRoleParseResult(fetchedTotal, roles, rejected);
}

async function fetchAllAppleSearchResults(config: AppleSearchConfig): Promise<AppleJobPosting[]> {
  const collected: AppleJobPosting[] = [];
  let totalRecords = Number.POSITIVE_INFINITY;

  for (let page = 1; page <= APPLE_MAX_PAGES; page += 1) {
    const url = buildAppleSearchPageUrl(config, page);
    const html = await fetchAppleSearchHtml(url);
    const loader = parseAppleHydrationPayload(html);
    totalRecords = loader.totalRecords ?? totalRecords;

    const batch = loader.searchResults ?? [];
    if (batch.length === 0) {
      break;
    }
    collected.push(...batch);

    if (collected.length >= totalRecords || batch.length < APPLE_PAGE_SIZE) {
      break;
    }
  }

  return dedupeAppleJobs(collected);
}

async function fetchAppleSearchHtml(url: string): Promise<string> {
  const res = await fetchWithTimeout(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": SCRAPER_USER_AGENT,
    },
  });
  if (!res.ok) {
    throw new Error(`Apple careers returned ${res.status} for ${url}`);
  }
  return await res.text();
}

function dedupeAppleJobs(jobs: AppleJobPosting[]): AppleJobPosting[] {
  const byId = new Map<string, AppleJobPosting>();
  for (const job of jobs) {
    const key = job.reqId?.trim() || job.id?.trim();
    if (!key) {
      continue;
    }
    byId.set(key, job);
  }
  return Array.from(byId.values());
}
