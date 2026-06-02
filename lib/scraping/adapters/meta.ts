import { atsPublishDate } from "../posted-date.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchWithTimeout, isHttpUrl, safeToIsoDate } from "./shared.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";

/** Meta Careers Comet GraphQL (CareersJobSearchResultsV2DataQuery). */
export const META_GRAPHQL_URL = "https://www.metacareers.com/graphql";
export const META_JOB_SEARCH_QUERY = "CareersJobSearchResultsV2DataQuery";
export const META_JOB_SEARCH_DOC_ID = "26703205452636175";

export const META_DEFAULT_SOURCE_URL =
  "https://www.metacareers.com/jobsearch?employment_type=Internship&q=software+engineer+intern";

const META_ORIGIN = "https://www.metacareers.com";
const META_JOB_DETAILS_PATH = "/profile/job_details/";
const META_DEFAULT_SEARCH_QUERIES = [
  "software engineer intern",
  "engineer intern",
  "research scientist intern",
  "data engineer intern",
];

const META_LD_JSON_RE = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/;
const META_LSD_TOKEN_RE = /"LSD",\[\],\{"token":"([^"]+)"/;

/** List titles must look internship-related before we fetch JSON-LD detail pages. */
const META_DETAIL_CONCURRENCY = 6;

export interface MetaSearchInput {
  q: string;
  teams?: string[];
  sub_teams?: string[];
  offices?: string[];
  roles?: string[];
  leadership_levels?: string[];
  employment_types?: string[];
  saved_searches?: string[];
  saved_jobs?: string[];
  is_leadership?: boolean;
  is_remote_only?: boolean;
  sort_by_new?: boolean;
  page?: number;
  results_per_page?: string;
}

export interface MetaJobSummary {
  id: string;
  title?: string;
  locations?: string[];
  teams?: string[];
  sub_teams?: string[];
}

export interface MetaJobSearchResponse {
  data?: {
    job_search_with_featured_jobs_v2?: {
      all_jobs?: MetaJobSummary[];
      featured_jobs?: MetaJobSummary[];
    };
  };
}

export interface MetaJobPostingJsonLd {
  title?: string;
  description?: string;
  responsibilities?: string;
  qualifications?: string;
  employmentType?: string;
  datePosted?: string;
  jobLocation?: Array<{
    name?: string;
    address?: {
      addressLocality?: string;
      addressRegion?: string;
      addressCountry?: { name?: string | string[] };
    };
  }>;
}

export interface MetaEnrichedJob {
  summary: MetaJobSummary;
  detail: MetaJobPostingJsonLd | null;
}

export function createMetaAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const resolvedSource = resolveMetaSource(source);

  return {
    source: resolvedSource,
    async fetchRoles() {
      const session = await fetchMetaSession(resolvedSource.sourceUrl);
      const summaries = await fetchAllMetaSummaries(session, resolvedSource);
      const candidates = summaries.filter((summary) =>
        INTERNSHIP_LIST_TITLE_PATTERN.test(summary.title?.trim() ?? ""),
      );
      const enriched = await enrichMetaJobs(session, candidates);
      return parseMetaJobs(enriched, resolvedSource, summaries.length);
    },
  };
}

export function resolveMetaSource(source: CompanySourceConfig): CompanySourceConfig {
  const sourceUrl = source.sourceUrl.trim() || META_DEFAULT_SOURCE_URL;
  return source.sourceUrl === sourceUrl ? source : { ...source, sourceUrl };
}

export function metaBrowserHeaders(): HeadersInit {
  return {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Ch-Ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"macOS"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
  };
}

export function buildMetaSearchInput(query: string): MetaSearchInput {
  return {
    q: query,
    teams: [],
    sub_teams: [],
    offices: [],
    roles: [],
    leadership_levels: [],
    employment_types: ["Internship"],
    saved_searches: [],
    saved_jobs: [],
    is_leadership: false,
    is_remote_only: false,
    sort_by_new: false,
    page: 1,
    results_per_page: "FIFTY",
  };
}

export function buildMetaPostingUrl(jobId: string): string {
  return `${META_ORIGIN}${META_JOB_DETAILS_PATH}${jobId}`;
}

export function parseMetaSearchQueries(source: CompanySourceConfig): string[] {
  const fromToken = (source.boardToken ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (fromToken.length > 0) {
    return fromToken;
  }

  try {
    const parsed = new URL(source.sourceUrl);
    const fromUrl = parsed.searchParams.get("q")?.trim();
    if (fromUrl) {
      return [fromUrl];
    }
  } catch {
    // fall through
  }

  return META_DEFAULT_SEARCH_QUERIES;
}

export function parseMetaJobPostingJsonLd(html: string): MetaJobPostingJsonLd | null {
  const match = html.match(META_LD_JSON_RE);
  if (!match) {
    return null;
  }

  try {
    const parsed = JSON.parse(match[1]) as { "@type"?: string };
    if (parsed["@type"] !== "JobPosting") {
      return null;
    }
    return parsed as MetaJobPostingJsonLd;
  } catch {
    return null;
  }
}

export function formatMetaLocations(job: MetaJobSummary | MetaJobPostingJsonLd): string[] {
  if ("locations" in job && Array.isArray(job.locations)) {
    return job.locations.map((location) => location.trim()).filter(Boolean);
  }

  const fromJsonLd = (job as MetaJobPostingJsonLd).jobLocation ?? [];
  return fromJsonLd
    .map((place: NonNullable<MetaJobPostingJsonLd["jobLocation"]>[number]) => {
      const name = place.name?.trim();
      if (name) return name;
      const locality = place.address?.addressLocality?.trim();
      const region = place.address?.addressRegion?.trim();
      return [locality, region].filter(Boolean).join(", ");
    })
    .filter(Boolean);
}

export function parseMetaJobs(
  jobs: MetaEnrichedJob[],
  source: CompanySourceConfig,
  fetchedCount: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const job of jobs) {
    const summary = job.summary;
    const detail = job.detail;
    const roleName = (detail?.title ?? summary.title)?.trim() || "";
    const postingUrl = buildMetaPostingUrl(summary.id);
    const locations = formatMetaLocations(detail ?? summary);
    const departments = [...(summary.teams ?? []), ...(summary.sub_teams ?? [])]
      .map((part) => part.trim())
      .filter(Boolean);
    const description = [
      detail?.description,
      detail?.responsibilities,
      detail?.qualifications,
    ]
      .filter(Boolean)
      .join("\n");

    const classification = classifyForSource(source, {
      title: roleName,
      description,
      employmentType: detail?.employmentType ?? null,
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
        description: [
          detail?.description,
          detail?.responsibilities,
          detail?.qualifications,
        ]
          .filter(Boolean)
          .join("\n"),
        dates: atsPublishDate(safeToIsoDate(detail?.datePosted)),
      }),
    );
  }

  return buildRoleParseResult(fetchedCount, roles, rejected);
}

export interface MetaSession {
  lsd: string | null;
  cookie: string | null;
  referer: string;
}

async function fetchMetaSession(sourceUrl: string): Promise<MetaSession> {
  const referer = sourceUrl.trim() || META_DEFAULT_SOURCE_URL;
  const res = await fetchWithMetaTimeout(referer, { headers: metaBrowserHeaders() });
  if (!res.ok) {
    throw new Error(`Meta landing page returned ${res.status} for ${referer}`);
  }

  const html = await res.text();
  const lsd = html.match(META_LSD_TOKEN_RE)?.[1] ?? null;
  const cookie = res.headers.getSetCookie?.().map((part) => part.split(";")[0]).join("; ") ?? null;

  return { lsd, cookie, referer };
}

async function fetchAllMetaSummaries(
  session: MetaSession,
  source: CompanySourceConfig,
): Promise<MetaJobSummary[]> {
  const queries = parseMetaSearchQueries(source);
  const byId = new Map<string, MetaJobSummary>();

  for (const query of queries) {
    const payload = await searchMetaJobs(session, buildMetaSearchInput(query));
    const result = payload.data?.job_search_with_featured_jobs_v2;
    for (const job of [...(result?.all_jobs ?? []), ...(result?.featured_jobs ?? [])]) {
      if (!job.id) continue;
      byId.set(job.id, job);
    }
  }

  return Array.from(byId.values());
}

async function searchMetaJobs(
  session: MetaSession,
  searchInput: MetaSearchInput,
): Promise<MetaJobSearchResponse> {
  const params = new URLSearchParams({
    fb_api_caller_class: "RelayModern",
    fb_api_req_friendly_name: META_JOB_SEARCH_QUERY,
    variables: JSON.stringify({ search_input: searchInput }),
    server_timestamps: "true",
    doc_id: META_JOB_SEARCH_DOC_ID,
    ...(session.lsd ? { lsd: session.lsd } : {}),
  });

  const res = await fetchWithMetaTimeout(META_GRAPHQL_URL, {
    method: "POST",
    headers: metaGraphqlHeaders(session),
    body: params.toString(),
  });

  if (!res.ok) {
    throw new Error(`Meta GraphQL returned ${res.status} for ${META_JOB_SEARCH_QUERY}`);
  }

  const payload = (await res.json()) as MetaJobSearchResponse & {
    errors?: Array<{ message?: string }>;
  };
  if (payload.errors?.length) {
    throw new Error(
      `Meta GraphQL error for ${META_JOB_SEARCH_QUERY}: ${payload.errors[0]?.message ?? "unknown"}`,
    );
  }

  return payload;
}

async function enrichMetaJobs(
  session: MetaSession,
  summaries: MetaJobSummary[],
): Promise<MetaEnrichedJob[]> {
  const enriched: MetaEnrichedJob[] = [];

  for (let index = 0; index < summaries.length; index += META_DETAIL_CONCURRENCY) {
    const batch = summaries.slice(index, index + META_DETAIL_CONCURRENCY);
    const details = await Promise.all(batch.map((summary) => fetchMetaJobDetail(session, summary.id)));
    for (let batchIndex = 0; batchIndex < batch.length; batchIndex++) {
      enriched.push({ summary: batch[batchIndex], detail: details[batchIndex] });
    }
  }

  return enriched;
}

async function fetchMetaJobDetail(
  session: MetaSession,
  jobId: string,
): Promise<MetaJobPostingJsonLd | null> {
  const url = buildMetaPostingUrl(jobId);
  const res = await fetchWithMetaTimeout(url, { headers: metaBrowserHeaders() });
  if (!res.ok) {
    return null;
  }
  return parseMetaJobPostingJsonLd(await res.text());
}

function metaGraphqlHeaders(session: MetaSession): HeadersInit {
  return {
    ...metaBrowserHeaders(),
    Accept: "*/*",
    "Content-Type": "application/x-www-form-urlencoded",
    Origin: META_ORIGIN,
    Referer: session.referer,
    "X-FB-Friendly-Name": META_JOB_SEARCH_QUERY,
    "X-FB-LSD": session.lsd ?? "",
    ...(session.cookie ? { Cookie: session.cookie } : {}),
  };
}

async function fetchWithMetaTimeout(url: string, init: RequestInit): Promise<Response> {
  return fetchWithTimeout(url, init);
}
