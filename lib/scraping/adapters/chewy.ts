import { atsPublishDate } from "../posted-date.ts";
import { classifyForSource } from "../adapter-parse.ts";
import { buildRoleParseResult } from "../role-parse-result.ts";
import { buildScrapedRole } from "../scraped-role-build.ts";
import { htmlToPlainText } from "../plain-text.ts";
import type { CompanySourceConfig, RoleParseResult, ScrapeAdapter } from "../types.ts";
import { fetchJsonWithTimeout, isHttpUrl, safeToIsoDate, scraperDelay } from "./shared.ts";
import { INTERNSHIP_LIST_TITLE_PATTERN } from "../list-filters.ts";

/** Chewy careers on Phenom Career Connect (refNum CHINUS). */
export const CHEWY_CAREERS_ORIGIN = "https://careers.chewy.com";
export const CHEWY_DEFAULT_CAREERS_URL = `${CHEWY_CAREERS_ORIGIN}/us/en/search-results`;
export const CHEWY_DEFAULT_REF_NUM = "CHINUS";

const CHEWY_PAGE_SIZE = 100;
const CHEWY_MAX_PAGES = 30;
const CHEWY_REQUEST_DELAY_MS = 200;
const CHEWY_DETAIL_CONCURRENCY = 6;

export interface ChewyBoardConfig {
  careersOrigin: string;
  widgetsUrl: string;
  refNum: string;
  locale: string;
  country: string;
}

export interface ChewyJobSummary {
  jobId?: string;
  reqId?: string;
  title?: string;
  descriptionTeaser?: string;
  applyUrl?: string;
  location?: string;
  cityState?: string;
  cityStateCountry?: string;
  country?: string;
  state?: string;
  city?: string;
  category?: string;
  type?: string;
  employmentType?: string;
  postedDate?: string;
  dateCreated?: string;
}

export interface ChewyJobDetail {
  jobId?: string;
  title?: string;
  description?: string;
  applyUrl?: string;
  location?: string;
  cityStateCountry?: string;
  postedDate?: string;
}

interface ChewyRefineSearchResponse {
  refineSearch?: {
    status?: number;
    totalHits?: number;
    data?: {
      jobs?: ChewyJobSummary[];
    };
  };
}

interface ChewyJobDetailResponse {
  jobDetail?: {
    status?: number;
    data?: {
      job?: ChewyJobDetail;
    };
  };
}

export function createChewyAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const board = resolveChewyBoard(source);
  const resolvedSource =
    source.boardToken === board.refNum ? source : { ...source, boardToken: board.refNum };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const summaries = await fetchAllChewySummaries(board);
      const candidates = summaries.filter((job) => isChewyListCandidate(job));
      const enriched = await enrichChewyJobs(board, candidates);
      return parseChewyJobs(enriched, resolvedSource, board, summaries.length);
    },
  };
}

export function resolveChewyBoard(source: CompanySourceConfig): ChewyBoardConfig {
  const refNum = source.boardToken?.trim() || CHEWY_DEFAULT_REF_NUM;
  const careersOrigin = parseChewyCareersOrigin(source.sourceUrl) ?? CHEWY_CAREERS_ORIGIN;
  const widgetsUrl = `${careersOrigin.replace(/\/$/, "")}/widgets`;

  return {
    careersOrigin,
    widgetsUrl,
    refNum: refNum || CHEWY_DEFAULT_REF_NUM,
    locale: "en_us",
    country: "us",
  };
}

export function parseChewyCareersOrigin(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.hostname.toLowerCase() === "careers.chewy.com") {
      return `${parsed.protocol}//${parsed.host}`;
    }
    return null;
  } catch {
    return null;
  }
}

export function isChewyListCandidate(job: ChewyJobSummary): boolean {
  return INTERNSHIP_LIST_TITLE_PATTERN.test(job.title?.trim() ?? "");
}

export function buildChewyPostingUrl(board: ChewyBoardConfig, job: ChewyJobSummary | ChewyJobDetail): string {
  const jobId = job.jobId?.trim();
  const title = job.title?.trim() ?? "";
  if (!jobId) {
    return "";
  }

  const slug = slugifyChewyTitle(title);
  const basePath = board.careersOrigin.includes("/us/en")
    ? board.careersOrigin.replace(/\/$/, "")
    : `${board.careersOrigin}/us/en`;

  return slug ? `${basePath}/job/${jobId}/${slug}` : `${basePath}/job/${jobId}`;
}

export function formatChewyLocation(job: ChewyJobSummary | ChewyJobDetail): string | null {
  const summary = job as ChewyJobSummary;
  return (
    summary.cityStateCountry?.trim() ||
    summary.cityState?.trim() ||
    summary.location?.trim() ||
    [summary.city, summary.state, summary.country].filter(Boolean).join(", ").trim() ||
    null
  );
}

export function parseChewyRefineSearchResponse(payload: unknown, url: string): ChewyJobSummary[] {
  if (!payload || typeof payload !== "object") {
    throw new Error(`Chewy refineSearch response was not JSON for ${url}`);
  }

  const response = payload as ChewyRefineSearchResponse;
  const jobs = response.refineSearch?.data?.jobs;
  if (!Array.isArray(jobs)) {
    throw new Error(`Chewy refineSearch missing jobs array for ${url}`);
  }

  return jobs;
}

export function parseChewyJobDetailResponse(payload: unknown, url: string): ChewyJobDetail | null {
  if (!payload || typeof payload !== "object") {
    throw new Error(`Chewy jobDetail response was not JSON for ${url}`);
  }

  const response = payload as ChewyJobDetailResponse;
  return response.jobDetail?.data?.job ?? null;
}

export function parseChewyJobs(
  jobs: Array<{ summary: ChewyJobSummary; detail: ChewyJobDetail | null }>,
  source: CompanySourceConfig,
  board: ChewyBoardConfig,
  fetchedCount: number,
): RoleParseResult {
  const roles: ReturnType<typeof buildScrapedRole>[] = [];
  const rejected: RoleParseResult["stats"]["rejected"] = [];

  for (const { summary, detail } of jobs) {
    const roleName = (detail?.title ?? summary.title)?.trim() || "";
    const description = detail?.description ?? summary.descriptionTeaser ?? "";
    const plainDescription = htmlToPlainText(description);
    const location = formatChewyLocation(detail ?? summary);
    const postingUrl = buildChewyPostingUrl(board, detail ?? summary);

    const classification = classifyForSource(source, {
      title: roleName,
      description: plainDescription,
      employmentType: summary.employmentType ?? summary.type ?? null,
      locations: location ? [location] : [],
      departments: summary.category ? [summary.category] : [],
    });

    if (!classification.include) {
      if (roleName) {
        rejected.push({ title: roleName, reason: classification.reason });
      }
      continue;
    }

    if (!postingUrl || !isHttpUrl(postingUrl)) {
      if (roleName) {
        rejected.push({ title: roleName, reason: "missing_posting_url" });
      }
      continue;
    }

    roles.push(
      buildScrapedRole({
        postingUrl,
        roleName,
        companyName: source.companyName,
        companySlug: source.companySlug,
        classification,
        description: detail?.description ?? summary.descriptionTeaser ?? "",
        dates: atsPublishDate(
        safeToIsoDate(detail?.postedDate ?? summary.postedDate ?? summary.dateCreated),
      ),
      }),
    );
  }

  return buildRoleParseResult(fetchedCount, roles, rejected);
}

async function fetchAllChewySummaries(board: ChewyBoardConfig): Promise<ChewyJobSummary[]> {
  const all: ChewyJobSummary[] = [];
  let from = 0;
  let totalHits = Number.POSITIVE_INFINITY;

  for (let page = 0; page < CHEWY_MAX_PAGES && from < totalHits; page += 1) {
    const payload = await postChewyWidget(board, {
      pageName: "search-results",
      size: CHEWY_PAGE_SIZE,
      from,
      jobs: true,
      counts: true,
      ddoKey: "refineSearch",
      keywords: "",
    });

    const batch = parseChewyRefineSearchResponse(payload, board.widgetsUrl);
    totalHits = payload.refineSearch?.totalHits ?? batch.length;
    all.push(...batch);

    if (batch.length === 0) {
      break;
    }

    from += batch.length;
    if (from >= totalHits) {
      break;
    }

    await scraperDelay(CHEWY_REQUEST_DELAY_MS);
  }

  return all;
}

async function enrichChewyJobs(
  board: ChewyBoardConfig,
  candidates: ChewyJobSummary[],
): Promise<Array<{ summary: ChewyJobSummary; detail: ChewyJobDetail | null }>> {
  const results: Array<{ summary: ChewyJobSummary; detail: ChewyJobDetail | null }> = [];

  for (let index = 0; index < candidates.length; index += CHEWY_DETAIL_CONCURRENCY) {
    const chunk = candidates.slice(index, index + CHEWY_DETAIL_CONCURRENCY);
    const details = await Promise.all(
      chunk.map(async (summary) => {
        const jobId = summary.jobId?.trim();
        if (!jobId) {
          return null;
        }

        try {
          const payload = await postChewyWidget(board, {
            ddoKey: "jobDetail",
            jobId,
          });
          return parseChewyJobDetailResponse(payload, board.widgetsUrl);
        } catch {
          return null;
        }
      }),
    );

    for (let i = 0; i < chunk.length; i += 1) {
      results.push({ summary: chunk[i], detail: details[i] });
    }

    if (index + CHEWY_DETAIL_CONCURRENCY < candidates.length) {
      await scraperDelay(CHEWY_REQUEST_DELAY_MS);
    }
  }

  return results;
}

async function postChewyWidget(
  board: ChewyBoardConfig,
  extra: Record<string, unknown>,
): Promise<ChewyRefineSearchResponse & ChewyJobDetailResponse> {
  const body = {
    lang: board.locale,
    deviceType: "desktop",
    country: board.country,
    refNum: board.refNum,
    siteType: "external",
    ...extra,
  };

  const res = await fetchJsonWithTimeout(board.widgetsUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Chewy Phenom widgets returned ${res.status} for ${board.widgetsUrl}`);
  }

  return (await res.json()) as ChewyRefineSearchResponse & ChewyJobDetailResponse;
}

function slugifyChewyTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
