import { isUsOnlyInternship } from "../../postings/us-only.ts";
import {
  canonicalizePostingUrl,
  contentHash,
  inferSeason,
  isTargetEngineeringInternshipRole,
  normalizeLocations,
  normalizeRoleName,
} from "../normalize.ts";
import type { NormalizedScrapedPosting, ScrapeAdapter, ScrapeSourceConfig } from "../types.ts";
import { atsJsonHeaders, dedupePostingsByCanonicalUrl, isHttpUrl, safeToIsoDate } from "./shared.ts";

const CAREERS_BASE = "https://www.amazon.jobs";
const SOURCE_URL = "https://www.amazon.jobs";
const SEARCH_API = "https://www.amazon.jobs/en/search.json";
const PAGE_SIZE = 100;
const SEARCH_QUERIES = ["intern", "co-op", "software development engineer intern"] as const;

export interface AmazonJob {
  id: string | number;
  id_icims?: string | number;
  title: string;
  job_path?: string;
  city?: string;
  state?: string;
  country_code?: string;
  location?: string;
  normalized_location?: string;
  locations?: string[];
  posted_date?: string;
  description?: string;
  description_short?: string;
  business_category?: string;
  job_category?: string;
  is_intern?: boolean | string | number;
  university_job?: boolean | string | number;
}

interface AmazonSearchResponse {
  hits?: number;
  jobs?: AmazonJob[];
}

export const amazonAdapter: ScrapeAdapter = {
  source: {
    companySlug: "amazon",
    companyName: "Amazon",
    sourceType: "custom",
    adapterKey: "amazon-jobs",
    sourceUrl: SOURCE_URL,
  },
  async fetchPostings() {
    const jobs = await fetchAllAmazonJobs();
    return parseAmazonJobs(jobs, amazonAdapter.source);
  },
};

export function parseAmazonJobs(
  jobs: readonly AmazonJob[],
  source: ScrapeSourceConfig,
): NormalizedScrapedPosting[] {
  const postings: NormalizedScrapedPosting[] = [];

  for (const job of jobs) {
    const rawTitle = job.title?.trim() || "";
    const context = stripHtml(job.description_short || job.description || "").slice(0, 500);
    if (!isTargetEngineeringInternshipRole(rawTitle, context)) {
      continue;
    }

    const postingUrl = resolvePostingUrl(job);
    const canonicalUrl = canonicalizePostingUrl(postingUrl);
    if (!canonicalUrl || !isHttpUrl(canonicalUrl)) {
      continue;
    }

    const locationStrings = parseAmazonLocationStrings(job);
    const normalizedLocations = normalizeLocations(locationStrings);
    if (!isUsOnlyInternship(normalizedLocations.locations)) {
      continue;
    }

    const season = inferSeason(rawTitle, context);
    const roleName = normalizeRoleName(rawTitle);
    const datePosted = parseAmazonPostedDate(job.posted_date);
    const hash = contentHash({
      roleName,
      canonicalUrl,
      locations: normalizedLocations.locations,
      season: season.season,
      seasonYear: season.seasonYear,
    });

    postings.push({
      companySlug: source.companySlug,
      companyName: source.companyName,
      roleName,
      roleNameRaw: rawTitle,
      postingUrl,
      canonicalUrl,
      externalJobId: job.id ? String(job.id) : null,
      datePosted,
      datePostedSource: datePosted ? "ats" : "unknown",
      season: season.season,
      seasonYear: season.seasonYear,
      seasonSource: season.seasonSource,
      ...normalizedLocations,
      contentHash: hash,
      metadata: {
        parser: "amazon-jobs-search",
        businessCategory: job.business_category,
        jobCategory: job.job_category,
        icimsId: job.id_icims ? String(job.id_icims) : undefined,
      },
    });
  }

  return dedupePostingsByCanonicalUrl(postings);
}

async function fetchAllAmazonJobs(): Promise<AmazonJob[]> {
  const byId = new Map<string | number, AmazonJob>();

  for (const query of SEARCH_QUERIES) {
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;

    while (offset < total) {
      const params = new URLSearchParams({
        base_query: query,
        country: "USA",
        offset: String(offset),
        result_limit: String(PAGE_SIZE),
        sort: "relevant",
      });

      const url = `${SEARCH_API}?${params}`;
      const res = await fetch(url, { headers: atsJsonHeaders() });
      if (!res.ok) {
        throw new Error(`Amazon Jobs API returned ${res.status} for ${url}`);
      }

      const payload = (await res.json()) as AmazonSearchResponse;
      const jobs = payload.jobs ?? [];
      total = payload.hits ?? jobs.length;

      for (const job of jobs) {
        byId.set(job.id, job);
      }

      if (jobs.length === 0 || jobs.length < PAGE_SIZE) {
        break;
      }
      offset += PAGE_SIZE;
    }
  }

  return Array.from(byId.values());
}

export function parseAmazonLocationStrings(job: AmazonJob): string[] {
  const parsed: string[] = [];

  for (const entry of job.locations ?? []) {
    if (!entry) continue;
    try {
      const location = JSON.parse(entry) as {
        normalizedLocation?: string;
        location?: string;
        type?: string;
      };
      const label = location.normalizedLocation?.trim() || location.location?.trim();
      if (label) parsed.push(label);
    } catch {
      const trimmed = entry.trim();
      if (trimmed) parsed.push(trimmed);
    }
  }

  if (parsed.length > 0) {
    return Array.from(new Set(parsed));
  }

  const fallback = [job.city, job.state, job.country_code]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
  if (fallback) return [fallback];

  const location = job.location?.trim() || job.normalized_location?.trim();
  return location ? [location] : [];
}

function resolvePostingUrl(job: AmazonJob): string {
  const path = job.job_path?.trim();
  if (path) {
    return new URL(path, CAREERS_BASE).toString();
  }
  return `${CAREERS_BASE}/en/jobs/${job.id}`;
}

function parseAmazonPostedDate(value: string | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return safeToIsoDate(new Date(cleaned));
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}
