import { unknownScrapedDates } from "../posted-date.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { extractLocationsFromPlainText } from "../location.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, resolveBoardToken } from "./shared.ts";

/**
 * Valve careers are a custom site (valvesoftware.com/en/jobs).
 * Open roles are listed via JSON at /en/jobs/job-search?search=… (broad query returns all postings).
 */
export const VALVE_CAREERS_ORIGIN = "https://www.valvesoftware.com";
export const VALVE_JOBS_PAGE_URL = `${VALVE_CAREERS_ORIGIN}/en/jobs`;
export const VALVE_DEFAULT_SEARCH_QUERY = "a";
export const VALVE_DEFAULT_JOB_SEARCH_URL = `${VALVE_CAREERS_ORIGIN}/en/jobs/job-search?search=${VALVE_DEFAULT_SEARCH_QUERY}`;

/** List titles must look internship-related before classification. */
const INTERNSHIP_LIST_TITLE_PATTERN =
  /\bintern(?:ship|ships)?\b|\bco-?op\b|\bfellowship\b|\buniversity\b|\bstudent\b/i;

export interface ValveBoardConfig {
  jobSearchUrl: string;
  careersOrigin: string;
  searchQuery: string;
}

export interface ValveJobPosting {
  reqid: number;
  name: string;
  description: string;
}

export function createValveAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveValveBoard(source);
  const resolvedSource =
    source.boardToken === board.searchQuery && source.sourceUrl === board.jobSearchUrl
      ? source
      : { ...source, boardToken: board.searchQuery, sourceUrl: board.jobSearchUrl };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const postings = await fetchValveJobPostings(board);
      const candidates = postings.filter((posting) => isValveListCandidate(posting));
      return parseValveJobs(candidates, resolvedSource, postings.length);
    },
  };
}

export function resolveValveBoard(source: CompanySourceConfig): ValveBoardConfig {
  const searchQuery =
    resolveBoardToken(source, parseValveSearchQueryFromUrl) || VALVE_DEFAULT_SEARCH_QUERY;
  const jobSearchUrl = normalizeValveJobSearchUrl(source.sourceUrl, searchQuery);

  return {
    jobSearchUrl,
    careersOrigin: VALVE_CAREERS_ORIGIN,
    searchQuery,
  };
}

export function normalizeValveJobSearchPayload(
  payload: ValveJobPosting[] | Record<string, ValveJobPosting>,
): ValveJobPosting[] {
  if (Array.isArray(payload)) {
    return payload.filter((item) => item?.reqid && item?.name);
  }

  return Object.values(payload).filter((item) => item?.reqid && item?.name);
}

export function buildValvePostingUrl(careersOrigin: string, reqid: number): string {
  const url = new URL(`${careersOrigin.replace(/\/$/, "")}/en/jobs`);
  url.searchParams.set("job_id", String(reqid));
  return url.toString();
}

export function valveJobDescription(posting: ValveJobPosting): string {
  return htmlToPlainText(posting.description ?? "");
}

export function isValveListCandidate(posting: ValveJobPosting): boolean {
  const haystack = [posting.name, valveJobDescription(posting)].filter(Boolean).join(" ");
  return INTERNSHIP_LIST_TITLE_PATTERN.test(haystack);
}

export function parseValveJobs(
  postings: ValveJobPosting[],
  source: CompanySourceConfig,
  fetchedCount: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const posting of postings) {
    const roleName = posting.name.trim();
    const postingUrl = buildValvePostingUrl(VALVE_CAREERS_ORIGIN, posting.reqid);
    const description = valveJobDescription(posting);

    const locations = extractLocationsFromPlainText(description);
    const classification = classifyForSource(source, {
      title: roleName,
      description,
      departments: [],
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
        description,
        dates: unknownScrapedDates(),
      }),
    );
  }

  return buildRoleParseResult(fetchedCount, roles, rejected);
}

async function fetchValveJobPostings(board: ValveBoardConfig): Promise<ValveJobPosting[]> {
  const res = await fetchJsonWithTimeout(board.jobSearchUrl, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Valve job search returned ${res.status} for ${board.jobSearchUrl}`);
  }

  const payload = (await res.json()) as ValveJobPosting[] | Record<string, ValveJobPosting>;
  return dedupeValvePostingsByReqId(normalizeValveJobSearchPayload(payload));
}

function dedupeValvePostingsByReqId(postings: ValveJobPosting[]): ValveJobPosting[] {
  const byReqId = new Map<number, ValveJobPosting>();
  for (const posting of postings) {
    byReqId.set(posting.reqid, posting);
  }
  return Array.from(byReqId.values());
}

export function parseValveSearchQueryFromUrl(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    const search = parsed.searchParams.get("search")?.trim();
    return search || null;
  } catch {
    return null;
  }
}

export function normalizeValveJobSearchUrl(sourceUrl: string, searchQuery: string): string {
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.pathname.includes("/job-search")) {
      return parsed.toString();
    }
  } catch {
    // fall through
  }

  const query = encodeURIComponent(searchQuery || VALVE_DEFAULT_SEARCH_QUERY);
  return `${VALVE_CAREERS_ORIGIN}/en/jobs/job-search?search=${query}`;
}

