import { atsPublishDate, unknownScrapedDates } from "../posted-date.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { htmlToPlainText } from "../plain-text.ts";
import { inferSeason } from "../season.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, safeToIsoDate } from "./shared.ts";

/**
 * D. E. Shaw careers run on a Next.js site (deshaw.com/careers). Open roles are
 * embedded in __NEXT_DATA__ on SSR pages — there is no public Greenhouse/Workday API.
 */
export const DE_SHAW_CAREERS_ORIGIN = "https://www.deshaw.com";
export const DE_SHAW_INTERNSHIPS_URL = `${DE_SHAW_CAREERS_ORIGIN}/careers/internships`;
export const DE_SHAW_CAREERS_URL = `${DE_SHAW_CAREERS_ORIGIN}/careers`;
export const DE_SHAW_DEFAULT_PAGE = "internships";

const NEXT_DATA_PATTERN = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/;
const CAREER_PATH_PATTERN = /href="(\/careers\/[^"]+-(\d+))"/g;

export interface DeShawBoardConfig {
  careersPageUrl: string;
  pageKey: string;
}

export interface DeShawJobRecord {
  data: {
    id: number;
    displayName: string;
    isActive?: boolean;
    validFromDate?: string | null;
    jobDescription?: {
      websiteDescription?: string | null;
    } | null;
    jobMetadata?: {
      workStatus?: string | null;
      jobLocations?: Array<{ name?: string; abbreviation?: string }>;
      jobSeekerCategories?: string[];
    } | null;
    department?: { name?: string } | null;
    jobCategory?: Array<{ name?: string }>;
  };
  id: number;
  displayName: string;
  office?: Array<{ name?: string; abbreviation?: string }>;
  header?: string[];
}

export interface DeShawListing {
  id: number;
  title: string;
  postingUrl: string;
  location: string | null;
  workStatus: string | null;
  departments: string[];
  description: string | null;
  datePosted: string | null;
  dates?: import("../posted-date.ts").ScrapedRoleDates;
}

export function createDeShawAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveDeShawBoard(source);
  const resolvedSource =
    source.sourceUrl === board.careersPageUrl && source.boardToken === board.pageKey
      ? source
      : { ...source, sourceUrl: board.careersPageUrl, boardToken: board.pageKey };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const html = await fetchDeShawCareersHtml(board.careersPageUrl);
      const pageProps = parseDeShawNextDataHtml(html);
      const pathById = indexDeShawCareerPaths(html);
      const listings = collectDeShawListings(pageProps, pathById);
      return parseDeShawJobs(listings, resolvedSource);
    },
  };
}

export function resolveDeShawBoard(source: CompanySourceConfig): DeShawBoardConfig {
  const pageKey = source.boardToken?.trim()
    ? normalizeDeShawPageKey(source.boardToken)
    : inferDeShawPageKeyFromUrl(source.sourceUrl);
  const careersPageUrl = deShawPageUrl(pageKey, source.sourceUrl);
  return { careersPageUrl, pageKey };
}

export function inferDeShawPageKeyFromUrl(sourceUrl: string): string {
  if (!isDeShawCareersUrl(sourceUrl)) {
    return DE_SHAW_DEFAULT_PAGE;
  }

  try {
    const pathname = new URL(sourceUrl).pathname.replace(/\/$/, "");
    if (pathname === "/careers/internships" || pathname.endsWith("/internships")) {
      return "internships";
    }
    if (pathname === "/careers") {
      return DE_SHAW_DEFAULT_PAGE;
    }
  } catch {
    // fall through
  }

  return DE_SHAW_DEFAULT_PAGE;
}

export function normalizeDeShawPageKey(token: string): string {
  const normalized = token.trim().toLowerCase();
  if (normalized === "internships" || normalized === "intern") {
    return "internships";
  }
  if (normalized === "careers" || normalized === "all" || normalized === "jobs") {
    return "careers";
  }
  return DE_SHAW_DEFAULT_PAGE;
}

export function deShawPageUrl(pageKey: string, sourceUrl: string): string {
  const normalizedKey = normalizeDeShawPageKey(pageKey);
  if (normalizedKey === "internships") {
    return DE_SHAW_INTERNSHIPS_URL;
  }
  if (normalizedKey === "careers") {
    return DE_SHAW_CAREERS_URL;
  }

  if (isDeShawCareersUrl(sourceUrl)) {
    try {
      const pathname = new URL(sourceUrl).pathname.replace(/\/$/, "");
      if (pathname.startsWith("/careers/") && pathname !== "/careers") {
        return sourceUrl.split("?")[0];
      }
    } catch {
      // fall through
    }
  }

  return DE_SHAW_INTERNSHIPS_URL;
}

export function isDeShawCareersUrl(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    return parsed.hostname.toLowerCase().replace(/^www\./, "") === "deshaw.com";
  } catch {
    return false;
  }
}

export function parseDeShawNextDataHtml(html: string): DeShawPageProps {
  const match = html.match(NEXT_DATA_PATTERN);
  if (!match?.[1]) {
    throw new Error("D. E. Shaw careers page did not include __NEXT_DATA__");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(match[1]);
  } catch {
    throw new Error("D. E. Shaw __NEXT_DATA__ was not valid JSON");
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("D. E. Shaw __NEXT_DATA__ was empty");
  }

  const pageProps = (payload as { props?: { pageProps?: DeShawPageProps } }).props?.pageProps;
  if (!pageProps) {
    throw new Error("D. E. Shaw __NEXT_DATA__ missing pageProps");
  }

  return pageProps;
}

export interface DeShawPageProps {
  internships?: DeShawJobRecord[];
  regularJobs?: DeShawJobRecord[];
}

export function indexDeShawCareerPaths(html: string): Map<number, string> {
  const paths = new Map<number, string>();
  for (const match of html.matchAll(CAREER_PATH_PATTERN)) {
    const path = match[1]?.trim();
    const id = Number(match[2]);
    if (!path || !Number.isFinite(id)) {
      continue;
    }
    paths.set(id, path);
  }
  return paths;
}

export function collectDeShawListings(
  pageProps: DeShawPageProps,
  pathById: Map<number, string>,
): DeShawListing[] {
  const records: DeShawJobRecord[] = [];

  if (pageProps.internships?.length) {
    records.push(...pageProps.internships);
  }

  if (pageProps.regularJobs?.length) {
    for (const job of pageProps.regularJobs) {
      if (isDeShawInternJob(job)) {
        records.push(job);
      }
    }
  }

  const listings: DeShawListing[] = [];
  const seenIds = new Set<number>();

  for (const job of records) {
    const id = job.id ?? job.data?.id;
    if (!id || seenIds.has(id) || job.data?.isActive === false) {
      continue;
    }
    seenIds.add(id);

    const path = pathById.get(id);
    if (!path) {
      continue;
    }

    const postingUrl = `${DE_SHAW_CAREERS_ORIGIN}${path}`;
    const title = (job.displayName ?? job.data?.displayName ?? "").trim();
    if (!title) {
      continue;
    }

    listings.push({
      id,
      title,
      postingUrl,
      location: formatDeShawLocation(job),
      workStatus: job.data?.jobMetadata?.workStatus?.trim() || null,
      departments: deShawDepartments(job),
      description: deShawWebsiteDescription(job),
      datePosted: null,
      dates: atsPublishDate(safeToIsoDate(job.data?.validFromDate)),
    });
  }

  return listings;
}

export function parseDeShawJobs(
  listings: DeShawListing[],
  source: CompanySourceConfig,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const listing of listings) {
    const classification = classifyForSource(source, {
      title: listing.title,
      description: listing.description,
      employmentType: listing.workStatus,
      departments: listing.departments,
      locations: listing.location ? [listing.location] : [],
    });

    if (!classification.include) {
      rejected.push({ title: listing.title, reason: classification.reason });
      continue;
    }

    if (!isHttpUrl(listing.postingUrl)) {
      rejected.push({ title: listing.title, reason: "invalid_url" });
      continue;
    }

    roles.push(
      buildScrapedRole({
        postingUrl: listing.postingUrl,
        roleName: listing.title,
        companyName: source.companyName,
        companySlug: source.companySlug,
        classification,
        description: listing.description,
        dates: listing.dates ?? unknownScrapedDates(),
        season: inferDeShawSeason(listing.title, listing.workStatus),
      }),
    );
  }

  return buildRoleParseResult(listings.length, roles, rejected);
}

export function inferDeShawSeason(title: string, workStatus: string | null) {
  return inferSeason([title, workStatus].filter(Boolean).join(" "));
}

export function isDeShawInternJob(job: DeShawJobRecord): boolean {
  const workStatus = job.data?.jobMetadata?.workStatus?.trim().toLowerCase() ?? "";
  if (workStatus === "intern") {
    return true;
  }

  const title = (job.displayName ?? job.data?.displayName ?? "").trim();
  return /\bintern(?:ship)?\b/i.test(title) && !/\binternal\b/i.test(title);
}

export function formatDeShawLocation(job: DeShawJobRecord): string | null {
  const fromOffice = (job.office ?? [])
    .map((office) => office.name?.trim() || office.abbreviation?.trim())
    .filter(Boolean) as string[];

  if (fromOffice.length > 0) {
    return fromOffice.join(" · ");
  }

  const fromMetadata = (job.data?.jobMetadata?.jobLocations ?? [])
    .map((location) => location.name?.trim() || location.abbreviation?.trim())
    .filter(Boolean) as string[];

  return fromMetadata.length > 0 ? fromMetadata.join(" · ") : null;
}

function deShawDepartments(job: DeShawJobRecord): string[] {
  const names = new Set<string>();
  const department = job.data?.department?.name?.trim();
  if (department) {
    names.add(department);
  }
  for (const category of job.data?.jobCategory ?? []) {
    const name = category.name?.trim();
    if (name) {
      names.add(name);
    }
  }
  for (const header of job.header ?? []) {
    const name = typeof header === "string" ? header.trim() : "";
    if (name) {
      names.add(name);
    }
  }
  return Array.from(names);
}

function deShawWebsiteDescription(job: DeShawJobRecord): string | null {
  const raw = job.data?.jobDescription?.websiteDescription;
  if (!raw?.trim()) {
    return null;
  }
  return htmlToPlainText(raw.replace(/&nbsp;/gi, " "));
}

async function fetchDeShawCareersHtml(url: string): Promise<string> {
  const res = await fetchJsonWithTimeout(url, {
    headers: {
      accept: "text/html,application/xhtml+xml,*/*",
    },
  });
  if (!res.ok) {
    throw new Error(`D. E. Shaw careers page returned ${res.status} for ${url}`);
  }
  return res.text();
}

