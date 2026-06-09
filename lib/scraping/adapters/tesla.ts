import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { isHttpUrl, scraperDelay } from "./shared.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";

/** Bulk careers snapshot used by tesla.com/careers/search (CUA careers-ui). */
export const TESLA_CAREERS_ORIGIN = "https://www.tesla.com";
export const TESLA_CAREERS_STATE_URL = `${TESLA_CAREERS_ORIGIN}/cua-api/apps/careers/state`;
export const TESLA_DEFAULT_SOURCE_URL =
  "https://www.tesla.com/careers/search/?query=intern&site=US";

const TESLA_INTERN_TYPE_ID = "3";

export interface TeslaBoardConfig {
  site: string | null;
  searchQuery: string | null;
  referer: string;
}

export interface TeslaListing {
  id: string;
  t: string;
  dp?: string;
  f?: string;
  l?: string;
  y?: number;
  sp?: number;
  pu?: string | null;
}

export interface TeslaCareersLookup {
  regions?: Record<string, string>;
  sites?: Record<string, string>;
  locations?: Record<string, string>;
  departments?: Record<string, string>;
  types?: Record<string, string>;
}

export interface TeslaCareersState {
  lookup: TeslaCareersLookup;
  listings: TeslaListing[];
}

export function createTeslaAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveTeslaBoard(source);
  const resolvedSource =
    source.boardToken === board.site && source.sourceUrl === board.referer
      ? source
      : { ...source, boardToken: board.site, sourceUrl: board.referer };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const session = await fetchTeslaSession(board.referer);
      const state = await fetchTeslaCareersState(board.referer, session.cookie);
      const candidates = state.listings.filter((listing) => isTeslaListCandidate(listing));
      return parseTeslaJobs(candidates, state.lookup, resolvedSource, state.listings.length);
    },
  };
}

export function resolveTeslaBoard(source: CompanySourceConfig): TeslaBoardConfig {
  const referer = source.sourceUrl.trim() || TESLA_DEFAULT_SOURCE_URL;
  let site = source.boardToken?.trim() || null;
  let searchQuery: string | null = null;

  try {
    const parsed = new URL(referer);
    site = site ?? parsed.searchParams.get("site")?.trim() ?? null;
    searchQuery = parsed.searchParams.get("query")?.trim() ?? null;
  } catch {
    // keep defaults
  }

  return { site, searchQuery, referer };
}

export function buildTeslaPostingUrl(listing: TeslaListing): string {
  const explicit = listing.pu?.trim();
  if (explicit && isHttpUrl(explicit)) {
    return explicit;
  }

  const slug = slugifyTeslaTitle(listing.t);
  return `${TESLA_CAREERS_ORIGIN}/careers/search/job/${slug}-${listing.id}`;
}

export function slugifyTeslaTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function formatTeslaLocation(lookup: TeslaCareersLookup, listing: TeslaListing): string | null {
  const locationId = listing.l?.trim();
  if (!locationId) {
    return null;
  }
  const label = lookup.locations?.[locationId]?.trim();
  return label || null;
}

export function teslaEmploymentType(lookup: TeslaCareersLookup, listing: TeslaListing): string | null {
  if (listing.y === undefined || listing.y === null) {
    return null;
  }
  return lookup.types?.[String(listing.y)] ?? null;
}

export function isTeslaListCandidate(listing: TeslaListing): boolean {
  const title = listing.t?.trim() ?? "";
  if (!title) {
    return false;
  }
  if (INTERNSHIP_LIST_TITLE_PATTERN.test(title)) {
    return true;
  }
  return String(listing.y ?? "") === TESLA_INTERN_TYPE_ID;
}

export function parseTeslaJobs(
  listings: TeslaListing[],
  lookup: TeslaCareersLookup,
  source: CompanySourceConfig,
  fetchedCount: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const listing of listings) {
    const roleName = listing.t?.trim() || "";
    const postingUrl = buildTeslaPostingUrl(listing);
    const locationLabel = formatTeslaLocation(lookup, listing);
    const locations = locationLabel ? [locationLabel] : [];
    const department = listing.dp ? lookup.departments?.[listing.dp]?.trim() : null;
    const departments = department ? [department] : [];
    const employmentType = teslaEmploymentType(lookup, listing);

    const classification = classifyForSource(source, {
      title: roleName,
      description: null,
      employmentType,
      departments,
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
      }),
    );
  }

  return buildRoleParseResult(fetchedCount, roles, rejected);
}

export function teslaBrowserHeaders(referer: string, cookie?: string | null): HeadersInit {
  return {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: referer,
    Origin: TESLA_CAREERS_ORIGIN,
    "Sec-Ch-Ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"macOS"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    ...(cookie ? { Cookie: cookie } : {}),
  };
}

function teslaStateHeaders(referer: string, cookie?: string | null): HeadersInit {
  return teslaBrowserHeaders(referer, cookie);
}

export interface TeslaSession {
  cookie: string | null;
  referer: string;
}

const TESLA_MAX_ATTEMPTS = 5;
const TESLA_RETRY_BASE_MS = 2_500;
const TESLA_RETRY_MAX_MS = 45_000;

export function computeTeslaRetryDelayMs(attempt: number, response?: Response): number {
  const retryAfter = response ? parseTeslaRetryAfterMs(response) : null;
  const backoff = TESLA_RETRY_BASE_MS * 2 ** attempt;
  return Math.min(retryAfter ?? backoff, TESLA_RETRY_MAX_MS);
}

export function parseTeslaRetryAfterMs(response: Response): number | null {
  const header = response.headers.get("retry-after")?.trim();
  if (!header) {
    return null;
  }

  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1000;
  }

  const retryAt = Date.parse(header);
  if (Number.isFinite(retryAt)) {
    return Math.max(0, retryAt - Date.now());
  }

  return null;
}

export async function fetchTeslaWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt < TESLA_MAX_ATTEMPTS; attempt += 1) {
    const res = await fetchWithTeslaTimeout(url, init);
    if (res.status !== 429) {
      return res;
    }

    lastResponse = res;
    if (attempt === TESLA_MAX_ATTEMPTS - 1) {
      break;
    }

    await scraperDelay(computeTeslaRetryDelayMs(attempt, res));
  }

  return lastResponse!;
}

export async function fetchTeslaSession(referer: string): Promise<TeslaSession> {
  const res = await fetchTeslaWithRetry(referer, { headers: teslaBrowserHeaders(referer) });
  if (!res.ok) {
    throw new Error(`Tesla careers landing page returned ${res.status} for ${referer}`);
  }

  await res.text();
  const cookie = res.headers.getSetCookie?.().map((part) => part.split(";")[0]).join("; ") ?? null;
  return { cookie, referer };
}

export async function fetchTeslaCareersState(
  referer: string,
  cookie?: string | null,
): Promise<TeslaCareersState> {
  const res = await fetchTeslaWithRetry(TESLA_CAREERS_STATE_URL, {
    headers: teslaStateHeaders(referer, cookie),
  });

  if (!res.ok) {
    throw new Error(`Tesla careers state returned ${res.status} for ${TESLA_CAREERS_STATE_URL}`);
  }

  const payload = (await res.json()) as TeslaCareersState;
  if (!Array.isArray(payload.listings) || !payload.lookup) {
    throw new Error("Tesla careers state payload missing listings or lookup");
  }

  return payload;
}

async function fetchWithTeslaTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

