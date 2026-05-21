import type { ScrapeAdapter, ScrapeSourceConfig, NormalizedScrapedPosting } from "../types.ts";
import { isUsOnlyInternship } from "../../postings/us-only.ts";
import {
  canonicalizePostingUrl,
  contentHash,
  inferSeason,
  isTargetEngineeringInternshipRole,
  normalizeLocations,
  normalizeRoleName,
} from "../normalize.ts";
import {
  atsJsonHeaders,
  dedupePostingsByCanonicalUrl,
  isHttpUrl,
  parseLeadingPathToken,
  resolveBoardToken,
  safeToIsoDate,
} from "./shared.ts";

interface GreenhouseJob {
  id: string | number;
  title?: string;
  absolute_url?: string;
  content?: string;
  location?: {
    name?: string;
  };
  updated_at?: string;
}

export function createGreenhouseAdapter(source: ScrapeSourceConfig): ScrapeAdapter {
  const boardToken = resolveBoardToken(
    source,
    (sourceUrl) => parseLeadingPathToken(sourceUrl, ["boards.greenhouse.io", "job-boards.greenhouse.io"]),
  );
  const resolvedSource = source.boardToken === boardToken ? source : { ...source, boardToken };

  return {
    source: resolvedSource,
    async fetchPostings() {
      const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;
      const res = await fetch(url, {
        headers: atsJsonHeaders(),
      });
      if (!res.ok) {
        throw new Error(`Greenhouse returned ${res.status} for ${url}`);
      }
      const payload = (await res.json()) as unknown;
      const jobs = parseGreenhouseResponse(payload, url);
      return parseGreenhouseJobs(jobs, resolvedSource);
    },
  };
}

export function parseGreenhouseJobs(jobs: GreenhouseJob[], source: ScrapeSourceConfig): NormalizedScrapedPosting[] {
  const postings: NormalizedScrapedPosting[] = [];
  for (const job of jobs) {
    const rawTitle = job.title?.trim() || "";
    const content = job.content || "";
    if (!isTargetEngineeringInternshipRole(rawTitle, content)) {
      continue;
    }

    const absoluteUrl = job.absolute_url || "";
    const canonicalUrl = canonicalizePostingUrl(absoluteUrl);
    if (!canonicalUrl || !isHttpUrl(canonicalUrl)) {
      continue;
    }

    const locationName = job.location?.name?.trim() || "";
    const locationList = locationName ? [locationName] : [];
    const normalizedLocations = normalizeLocations(locationList);
    if (!isUsOnlyInternship(normalizedLocations.locations)) {
      continue;
    }
    const season = inferSeason(rawTitle, content);
    const roleName = normalizeRoleName(rawTitle);
    const datePosted = safeToIsoDate(job.updated_at);

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
      postingUrl: absoluteUrl,
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
        parser: "greenhouse-json",
      },
    });
  }
  return dedupePostingsByCanonicalUrl(postings);
}

function parseGreenhouseResponse(payload: unknown, url: string): GreenhouseJob[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { jobs?: unknown }).jobs)) {
    throw new Error(`Greenhouse response was not in expected format for ${url}`);
  }
  return (payload as { jobs: GreenhouseJob[] }).jobs;
}
