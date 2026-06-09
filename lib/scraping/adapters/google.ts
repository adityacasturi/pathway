import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { looksLikeGeographicLocation, normalizeScrapedLocationPart } from "../location.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, safeToIsoDate, scraperDelay } from "./shared.ts";

export const GOOGLE_CAREERS_ORIGIN = "https://www.google.com/about/careers/applications";
export const GOOGLE_DEFAULT_RESULTS_URL =
  "https://www.google.com/about/careers/applications/jobs/results/?location=United%20States&target_level=INTERN_AND_APPRENTICE&organization=Google";

const GOOGLE_PAGE_SIZE_FALLBACK = 20;
const GOOGLE_MAX_PAGES = 80;
const GOOGLE_REQUEST_DELAY_MS = 350;

const DS1_CALLBACK_MARKER = "AF_initDataCallback({key: 'ds:1'";

/** Tuple row from Google Careers `ds:1` embedded payload. */
export type GoogleJobRow = unknown[];

export interface GoogleJobsPageData {
  jobs: GoogleJobRow[];
  total: number | null;
  pageSize: number | null;
}

export function createGoogleAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const searchBaseUrl = resolveGoogleSearchUrl(source);
  const resolvedSource = source.sourceUrl === searchBaseUrl ? source : { ...source, sourceUrl: searchBaseUrl };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const pages = await fetchAllGoogleJobPages(searchBaseUrl);
      return parseGoogleJobs(pages, resolvedSource);
    },
  };
}

export function resolveGoogleSearchUrl(source: CompanySourceConfig): string {
  const fromSource = source.sourceUrl?.trim();
  if (fromSource && isHttpUrl(fromSource)) {
    return fromSource;
  }
  return GOOGLE_DEFAULT_RESULTS_URL;
}

export async function fetchAllGoogleJobPages(searchBaseUrl: string): Promise<GoogleJobRow[]> {
  const base = new URL(searchBaseUrl);
  const allJobs: GoogleJobRow[] = [];
  const seenIds = new Set<string>();

  for (let page = 1; page <= GOOGLE_MAX_PAGES; page++) {
    const pageUrl = new URL(base);
    pageUrl.searchParams.set("page", String(page));

    const html = await fetchGoogleResultsHtml(pageUrl.toString());
    const payload = extractGoogleJobsPageData(html);
    if (!payload || payload.jobs.length === 0) {
      break;
    }

    let added = 0;
    for (const job of payload.jobs) {
      const id = googleJobId(job);
      if (!id || seenIds.has(id)) {
        continue;
      }
      seenIds.add(id);
      allJobs.push(job);
      added++;
    }

    const pageSize = payload.pageSize ?? GOOGLE_PAGE_SIZE_FALLBACK;
    const total = payload.total;
    const maxPage = total && pageSize > 0 ? Math.ceil(total / pageSize) : page;
    if (page >= maxPage || added === 0) {
      break;
    }

    await scraperDelay(GOOGLE_REQUEST_DELAY_MS);
  }

  return allJobs;
}

export function extractGoogleJobsPageData(html: string): GoogleJobsPageData | null {
  const start = html.indexOf(DS1_CALLBACK_MARKER);
  if (start < 0) {
    return null;
  }

  const dataLabel = html.indexOf("data:", start);
  const sideChannel = html.indexOf("sideChannel:", dataLabel);
  if (dataLabel < 0 || sideChannel < 0) {
    return null;
  }

  let raw = html.slice(dataLabel + 5, sideChannel).trim();
  if (raw.endsWith(",")) {
    raw = raw.slice(0, -1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }

  if (!Array.isArray(parsed) || !Array.isArray(parsed[0])) {
    return null;
  }

  const total = typeof parsed[2] === "number" ? parsed[2] : null;
  const pageSize = typeof parsed[3] === "number" ? parsed[3] : null;

  return {
    jobs: parsed[0] as GoogleJobRow[],
    total,
    pageSize,
  };
}

export function parseGoogleJobs(jobs: GoogleJobRow[], source: CompanySourceConfig): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const job of jobs) {
    const roleName = googleJobTitle(job);
    const postingUrl = buildGooglePostingUrl(googleJobId(job));
    const description = googleJobDescription(job);
    const locations = googleJobLocations(job);

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      employmentType: googleJobEmploymentType(job),
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
        description: googleJobDescription(job),
      }),
    );
  }

  return buildRoleParseResult(jobs.length, roles, rejected);
}

export function buildGooglePostingUrl(jobId: string | null): string | null {
  if (!jobId) {
    return null;
  }
  return `${GOOGLE_CAREERS_ORIGIN}/jobs/results/${encodeURIComponent(jobId)}`;
}

export function googleJobId(job: GoogleJobRow): string | null {
  const id = job[0];
  if (typeof id === "string" && id.trim()) {
    return id.trim();
  }
  if (typeof id === "number" && Number.isFinite(id)) {
    return String(id);
  }
  return null;
}

export function googleJobTitle(job: GoogleJobRow): string {
  const title = job[1];
  return typeof title === "string" ? title.trim() : "";
}

export function googleJobLocations(job: GoogleJobRow): string[] {
  const raw = job[9];
  if (!Array.isArray(raw)) {
    return [];
  }

  const locations: string[] = [];
  for (const entry of raw) {
    if (!Array.isArray(entry)) {
      continue;
    }

    const label = typeof entry[0] === "string" ? entry[0].trim() : "";
    const city = typeof entry[2] === "string" ? entry[2].trim() : "";
    const region = typeof entry[4] === "string" ? entry[4].trim() : "";
    const countryCode = typeof entry[5] === "string" ? entry[5].trim().toUpperCase() : "";

    const fromTuple = formatGoogleLocationTuple(city, region, countryCode);
    const candidate =
      label && looksLikeGeographicLocation(label) ? label : fromTuple || label;
    const normalized = candidate ? normalizeScrapedLocationPart(candidate) : null;
    if (normalized) {
      locations.push(normalized);
    }
  }
  return locations;
}

function formatGoogleLocationTuple(city: string, region: string, countryCode: string): string | null {
  const country =
    countryCode === "US"
      ? "USA"
      : countryCode === "GB"
        ? "UK"
        : countryCode.length === 2
          ? countryCode
          : "";

  const parts = [city, region, country].filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  const joined = parts.join(", ");
  return looksLikeGeographicLocation(joined) ? joined : null;
}

export function googleJobEmploymentType(job: GoogleJobRow): string | null {
  const applicationNotes = googleHtmlField(job[15]);
  if (/\binternship\s+program\b/i.test(applicationNotes)) {
    return "Internship";
  }

  const title = googleJobTitle(job);
  if (/\bstudent\s+(?:researcher|ambassador)\b/i.test(title)) {
    return "Internship";
  }

  return null;
}

export function googleJobDescription(job: GoogleJobRow): string {
  const chunks: string[] = [];
  for (const index of [15, 3, 4, 10, 18, 19]) {
    const field = job[index];
    const html = googleHtmlField(field);
    if (html) {
      chunks.push(htmlToPlainText(html));
    }
  }
  return chunks.filter(Boolean).join("\n\n");
}

export function googleJobDatePosted(job: GoogleJobRow): string | null {
  for (const index of [12, 13, 14]) {
    const parsed = googleTimestampToIso(job[index]);
    if (parsed) {
      return parsed;
    }
  }
  return null;
}

function googleHtmlField(value: unknown): string {
  if (!Array.isArray(value) || value.length < 2) {
    return "";
  }
  const html = value[1];
  return typeof html === "string" ? html : "";
}

function googleTimestampToIso(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  const seconds = value[0];
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  const nanos = typeof value[1] === "number" && Number.isFinite(value[1]) ? value[1] : 0;
  const millis = seconds * 1000 + Math.floor(nanos / 1_000_000);
  return safeToIsoDate(new Date(millis));
}

async function fetchGoogleResultsHtml(url: string): Promise<string> {
  const res = await fetchJsonWithTimeout(url, {
    headers: {
      accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    },
  });
  if (!res.ok) {
    throw new Error(`Google Careers returned ${res.status} for ${url}`);
  }
  return res.text();
}

