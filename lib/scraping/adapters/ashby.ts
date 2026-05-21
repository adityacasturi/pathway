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

interface AshbyJob {
  id: string | number;
  title?: string;
  employmentType?: string;
  jobUrl?: string;
  location?: string;
  secondaryLocations?: (string | { location?: string; name?: string })[];
  description?: string;
  descriptionHtml?: string;
  publishedAt?: string;
  publishedDate?: string;
  updatedAt?: string;
}

export function createAshbyAdapter(source: ScrapeSourceConfig): ScrapeAdapter {
  const boardToken = resolveBoardToken(source, (sourceUrl) => parseLeadingPathToken(sourceUrl, ["jobs.ashbyhq.com"]));
  const resolvedSource = source.boardToken === boardToken ? source : { ...source, boardToken };

  return {
    source: resolvedSource,
    async fetchPostings() {
      const url = `https://api.ashbyhq.com/posting-api/job-board/${boardToken}`;
      const res = await fetch(url, {
        headers: atsJsonHeaders(),
      });
      if (!res.ok) {
        throw new Error(`Ashby returned ${res.status} for ${url}`);
      }
      const payload = (await res.json()) as unknown;
      const jobs = parseAshbyResponse(payload, url);
      return parseAshbyJobs(jobs, resolvedSource);
    },
  };
}

export function parseAshbyJobs(jobs: AshbyJob[], source: ScrapeSourceConfig): NormalizedScrapedPosting[] {
  const postings: NormalizedScrapedPosting[] = [];
  for (const job of jobs) {
    const rawTitle = job.title?.trim() || "";
    const employmentType = job.employmentType?.trim().toLowerCase() || "";
    const description = job.descriptionHtml || job.description || "";
    const internshipContext = `${employmentType} ${description}`;
    if (!isTargetEngineeringInternshipRole(rawTitle, internshipContext)) {
      continue;
    }

    const jobUrl = job.jobUrl || `https://jobs.ashbyhq.com/${source.boardToken || source.companySlug}/${job.id}`;
    const canonicalUrl = canonicalizePostingUrl(jobUrl);
    if (!canonicalUrl || !isHttpUrl(canonicalUrl)) {
      continue;
    }

    const primaryLocation = job.location || "";
    const secondaryLocations = job.secondaryLocations || [];
    const locationsList: string[] = [];
    if (primaryLocation) {
      locationsList.push(primaryLocation);
    }
    for (const sec of secondaryLocations) {
      if (typeof sec === "string") {
        locationsList.push(sec);
      } else if (sec && typeof sec === "object") {
        const val = sec.location || sec.name || "";
        if (val) {
          locationsList.push(val);
        }
      }
    }

    const locations = Array.from(
      new Set(
        locationsList
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

    const dateStr = job.publishedAt || job.publishedDate || job.updatedAt || null;
    const datePosted = safeToIsoDate(dateStr);

    postings.push({
      companySlug: source.companySlug,
      companyName: source.companyName,
      roleName,
      roleNameRaw: rawTitle,
      postingUrl: jobUrl,
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
        parser: "ashby-json",
      },
    });
  }
  return dedupePostingsByCanonicalUrl(postings);
}

function parseAshbyResponse(payload: unknown, url: string): AshbyJob[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { jobs?: unknown }).jobs)) {
    throw new Error(`Ashby response was not in expected format for ${url}`);
  }
  return (payload as { jobs: AshbyJob[] }).jobs;
}
