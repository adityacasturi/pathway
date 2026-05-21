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

interface LeverJob {
  id: string;
  text?: string;
  hostedUrl?: string;
  description?: string;
  categories?: {
    location?: string;
    allLocations?: string[];
  };
  createdAt?: number;
}

export function createLeverAdapter(source: ScrapeSourceConfig): ScrapeAdapter {
  const boardToken = resolveBoardToken(source, (sourceUrl) => parseLeadingPathToken(sourceUrl, ["jobs.lever.co"]));
  const resolvedSource = source.boardToken === boardToken ? source : { ...source, boardToken };

  return {
    source: resolvedSource,
    async fetchPostings() {
      const url = `https://api.lever.co/v0/postings/${boardToken}?mode=json`;
      const res = await fetch(url, {
        headers: atsJsonHeaders(),
      });
      if (!res.ok) {
        throw new Error(`Lever returned ${res.status} for ${url}`);
      }
      const payload = (await res.json()) as unknown;
      const jobs = parseLeverResponse(payload, url);
      return parseLeverJobs(jobs, resolvedSource);
    },
  };
}

export function parseLeverJobs(jobs: LeverJob[], source: ScrapeSourceConfig): NormalizedScrapedPosting[] {
  const postings: NormalizedScrapedPosting[] = [];
  for (const job of jobs) {
    const rawTitle = job.text?.trim() || "";
    const description = job.description || "";
    if (!isTargetEngineeringInternshipRole(rawTitle, description)) {
      continue;
    }

    const hostedUrl = job.hostedUrl || "";
    const canonicalUrl = canonicalizePostingUrl(hostedUrl);
    if (!canonicalUrl || !isHttpUrl(canonicalUrl)) {
      continue;
    }

    const primaryLocation = job.categories?.location?.trim() || "";
    const additionalLocations = job.categories?.allLocations || [];
    const locations = Array.from(
      new Set(
        [primaryLocation, ...additionalLocations]
          .map((loc) => loc.trim())
          .filter(Boolean),
      ),
    );

    const normalizedLocations = normalizeLocations(locations);
    if (!isUsOnlyInternship(normalizedLocations.locations)) {
      continue;
    }
    const season = inferSeason(rawTitle, description);
    const roleName = normalizeRoleName(rawTitle);

    const hash = contentHash({
      roleName,
      canonicalUrl,
      locations: normalizedLocations.locations,
      season: season.season,
      seasonYear: season.seasonYear,
    });

    const datePosted = safeToIsoDate(job.createdAt);

    postings.push({
      companySlug: source.companySlug,
      companyName: source.companyName,
      roleName,
      roleNameRaw: rawTitle,
      postingUrl: hostedUrl,
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
        parser: "lever-json",
      },
    });
  }
  return dedupePostingsByCanonicalUrl(postings);
}

function parseLeverResponse(payload: unknown, url: string): LeverJob[] {
  if (!Array.isArray(payload)) {
    throw new Error(`Lever response was not in expected format for ${url}`);
  }
  return payload as LeverJob[];
}
