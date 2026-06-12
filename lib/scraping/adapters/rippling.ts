import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import type { StructuredPlaceInput } from "../../geo/types.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl } from "./shared.ts";

export const RIPPLING_CAREERS_URL = "https://www.rippling.com/careers/open-roles";
export const RIPPLING_BOARD_TOKEN = "rippling";
export const RIPPLING_ALGOLIA_APP_ID = "6FNAX3TBEF";
export const RIPPLING_ALGOLIA_API_KEY = "416caa4690f002ff6fe4a2097623640b";
export const RIPPLING_ALGOLIA_INDEX_NAME = "careers_en-US_production";
const RIPPLING_ALGOLIA_HITS_PER_PAGE = 1000;

export interface RipplingBoardConfig {
  careersUrl: string;
  boardToken: string;
}

export interface RipplingJobLocation {
  name?: string;
  country?: string;
  countryCode?: string;
  state?: string;
  stateCode?: string;
  city?: string;
  workplaceType?: string;
}

export interface RipplingJob {
  id: string;
  name: string;
  url: string;
  department?: { name?: string };
  locations?: RipplingJobLocation[];
  locationNames?: string[];
  language?: string;
}

interface RipplingAlgoliaHit {
  objectID?: string;
  jobId?: string;
  name?: string;
  url?: string;
  department?: { name?: string };
  departmentName?: string;
  isRemote?: boolean;
  locations?: RipplingJobLocation[];
  locationNames?: string[];
}

type RipplingAlgoliaJobHit = RipplingAlgoliaHit & {
  jobId: string;
  name: string;
  url: string;
};

interface RipplingAlgoliaSearchResult {
  hits?: unknown[];
  nbHits?: number;
  page?: number;
  nbPages?: number;
}

export function createRipplingAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveRipplingBoard(source);
  const resolvedSource =
    source.sourceUrl === board.careersUrl && source.boardToken === board.boardToken
      ? source
      : { ...source, sourceUrl: board.careersUrl, boardToken: board.boardToken };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const html = await fetchRipplingCareersHtml(board.careersUrl);
      const indexName = extractRipplingAlgoliaIndexName(html) ?? RIPPLING_ALGOLIA_INDEX_NAME;
      const jobs = await fetchRipplingAlgoliaJobs(indexName);
      if (jobs.length > 0) {
        return parseRipplingJobs(jobs, resolvedSource);
      }

      const legacyJobs = extractRipplingJobsFromCareersHtml(html);
      return parseRipplingJobs(legacyJobs, resolvedSource);
    },
  };
}

export function resolveRipplingBoard(source: CompanySourceConfig): RipplingBoardConfig {
  const careersUrl = isRipplingCareersUrl(source.sourceUrl) ? source.sourceUrl.trim() : RIPPLING_CAREERS_URL;
  const boardToken = source.boardToken?.trim() || RIPPLING_BOARD_TOKEN;
  return { careersUrl, boardToken };
}

export function isRipplingCareersUrl(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    return (
      parsed.hostname.replace(/^www\./, "") === "rippling.com" &&
      parsed.pathname.startsWith("/careers")
    );
  } catch {
    return false;
  }
}

export function extractRipplingJobsFromCareersHtml(html: string): RipplingJob[] {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match?.[1]) {
    return [];
  }

  try {
    const data = JSON.parse(match[1]) as {
      props?: { pageProps?: { jobs?: { items?: unknown } } };
    };
    const items = data.props?.pageProps?.jobs?.items;
    if (!Array.isArray(items)) {
      return [];
    }

    const jobs = items.filter(
      (item): item is RipplingJob =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as RipplingJob).id === "string" &&
        typeof (item as RipplingJob).name === "string" &&
        typeof (item as RipplingJob).url === "string",
    );

    return dedupeRipplingJobs(jobs);
  } catch {
    return [];
  }
}

export function extractRipplingAlgoliaIndexName(html: string): string | null {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match?.[1]) {
    return null;
  }

  try {
    const data = JSON.parse(match[1]) as {
      props?: { pageProps?: { data?: { algoliaIndexName?: unknown } } };
    };
    const indexName = data.props?.pageProps?.data?.algoliaIndexName;
    return typeof indexName === "string" && indexName.trim() ? indexName.trim() : null;
  } catch {
    return null;
  }
}

export function parseRipplingAlgoliaHits(hits: unknown[]): RipplingJob[] {
  const jobs: RipplingJob[] = [];

  for (const hit of hits) {
    if (!isRipplingAlgoliaHit(hit)) {
      continue;
    }

    const id = hit.jobId.trim() || hit.objectID?.trim();
    const name = hit.name.trim();
    const url = hit.url.trim();
    if (!id || !name || !url) {
      continue;
    }

    jobs.push({
      id,
      name,
      url,
      department: hit.department?.name?.trim()
        ? { name: hit.department.name.trim() }
        : hit.departmentName?.trim()
          ? { name: hit.departmentName.trim() }
          : undefined,
      locations: hit.locations,
      locationNames: hit.locationNames,
    });
  }

  return dedupeRipplingJobs(jobs);
}

export function parseRipplingJobs(jobs: RipplingJob[], source: CompanySourceConfig): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const job of jobs) {
    const roleName = job.name.trim();
    const postingUrl = job.url.trim();
    const departments = job.department?.name?.trim() ? [job.department.name.trim()] : [];
    const structuredLocations = collectRipplingStructuredPlaces(job);
    const locations = structuredLocations
      .map((place) => place.rawLabel?.trim())
      .filter(Boolean) as string[];

    const classification = classifyForSource(source, {
      title: roleName,
      description: "",
      departments,
      structuredLocations,
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
        description: "",
        seasonHints: {
          departments,
        },
      }),
    );
  }

  return buildRoleParseResult(jobs.length, roles, rejected);
}

export function collectRipplingStructuredPlaces(job: RipplingJob): StructuredPlaceInput[] {
  const places: StructuredPlaceInput[] = [];

  for (const location of job.locations ?? []) {
    const remote = location.workplaceType?.toUpperCase() === "REMOTE";
    const city = location.city?.trim() || null;
    const region = location.stateCode?.trim() || location.state?.trim() || null;
    const countryCode = location.countryCode?.trim() || null;
    const rawLabel = location.name?.trim() || null;

    if (!city && !region && !countryCode && !rawLabel) {
      continue;
    }

    places.push({ city, region, countryCode, rawLabel, remote });
  }

  for (const rawLabel of job.locationNames ?? []) {
    const trimmed = rawLabel.trim();
    if (!trimmed) {
      continue;
    }
    const alreadyIncluded = places.some((place) => place.rawLabel === trimmed);
    if (!alreadyIncluded) {
      places.push({ rawLabel: trimmed, remote: /^remote\b/i.test(trimmed) });
    }
  }

  return places;
}

function dedupeRipplingJobs(jobs: RipplingJob[]): RipplingJob[] {
  const byId = new Map<string, RipplingJob>();
  for (const job of jobs) {
    const existing = byId.get(job.id);
    if (!existing) {
      byId.set(job.id, job);
      continue;
    }

    byId.set(job.id, {
      ...existing,
      locations: mergeRipplingLocations(existing.locations, job.locations),
      locationNames: mergeStrings(existing.locationNames, job.locationNames),
    });
  }
  return Array.from(byId.values());
}

async function fetchRipplingAlgoliaJobs(indexName: string): Promise<RipplingJob[]> {
  const jobs: RipplingJob[] = [];
  let page = 0;
  let nbPages = 1;

  do {
    const result = await fetchRipplingAlgoliaPage(indexName, page);
    jobs.push(...parseRipplingAlgoliaHits(result.hits ?? []));
    nbPages = result.nbPages ?? page + 1;
    page += 1;
  } while (page < nbPages);

  return dedupeRipplingJobs(jobs);
}

async function fetchRipplingAlgoliaPage(
  indexName: string,
  page: number,
): Promise<RipplingAlgoliaSearchResult> {
  const params = new URLSearchParams({
    query: "",
    hitsPerPage: String(RIPPLING_ALGOLIA_HITS_PER_PAGE),
    page: String(page),
  });

  const res = await fetchJsonWithTimeout(
    `https://${RIPPLING_ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/*/queries`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-algolia-api-key": RIPPLING_ALGOLIA_API_KEY,
        "x-algolia-application-id": RIPPLING_ALGOLIA_APP_ID,
      },
      body: JSON.stringify({
        requests: [{ indexName, params: params.toString() }],
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`Rippling Algolia returned ${res.status} for ${indexName}`);
  }

  const data = (await res.json()) as { results?: unknown[] };
  const result = data.results?.[0];
  if (!isRipplingAlgoliaSearchResult(result)) {
    return { hits: [], nbPages: 0 };
  }

  return result;
}

async function fetchRipplingCareersHtml(url: string): Promise<string> {
  const res = await fetchJsonWithTimeout(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!res.ok) {
    throw new Error(`Rippling careers returned ${res.status} for ${url}`);
  }

  return res.text();
}

function isRipplingAlgoliaHit(value: unknown): value is RipplingAlgoliaJobHit {
  if (!value || typeof value !== "object") {
    return false;
  }
  const hit = value as RipplingAlgoliaHit;
  return (
    typeof hit.jobId === "string" &&
    typeof hit.name === "string" &&
    typeof hit.url === "string"
  );
}

function isRipplingAlgoliaSearchResult(value: unknown): value is RipplingAlgoliaSearchResult {
  if (!value || typeof value !== "object") {
    return false;
  }
  const result = value as RipplingAlgoliaSearchResult;
  return Array.isArray(result.hits);
}

function mergeRipplingLocations(
  first: RipplingJobLocation[] | undefined,
  second: RipplingJobLocation[] | undefined,
): RipplingJobLocation[] | undefined {
  const merged = new Map<string, RipplingJobLocation>();
  for (const location of [...(first ?? []), ...(second ?? [])]) {
    const key = JSON.stringify({
      name: location.name,
      country: location.country,
      countryCode: location.countryCode,
      state: location.state,
      stateCode: location.stateCode,
      city: location.city,
      workplaceType: location.workplaceType,
    });
    merged.set(key, location);
  }
  return merged.size > 0 ? Array.from(merged.values()) : undefined;
}

function mergeStrings(first: string[] | undefined, second: string[] | undefined): string[] | undefined {
  const values = [...(first ?? []), ...(second ?? [])].map((value) => value.trim()).filter(Boolean);
  const merged = Array.from(new Set(values));
  return merged.length > 0 ? merged : undefined;
}
