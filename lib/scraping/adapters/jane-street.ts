import { isUsOnlyInternship } from "../../postings/us-only.ts";
import {
  canonicalizePostingUrl,
  contentHash,
  inferSeason,
  isTargetEngineeringInternshipRole,
  normalizeLocations,
  normalizeRoleName,
} from "../normalize.ts";
import type { NormalizedScrapedPosting, ScrapeAdapter } from "../types.ts";

const SOURCE_URL = "https://www.janestreet.com/join-jane-street/open-roles/";
const JOBS_URL = "https://www.janestreet.com/jobs/main.json";
const POSITION_DIRECTORIES_URL = "https://www.janestreet.com/static/position-directories.json";
const BASE_URL = "https://www.janestreet.com";

const KNOWN_LOCATIONS = [
  "New York",
  "London",
  "Hong Kong",
  "Singapore",
  "Amsterdam",
  "Chicago",
  "Remote",
];

const CITY_NAMES: Record<string, string> = {
  NYC: "New York",
  LDN: "London",
  HKG: "Hong Kong",
  AMS: "Amsterdam",
  CHI: "Chicago",
  SGP: "Singapore",
  MUM: "Mumbai",
  SHA: "Shanghai",
  PHL: "Philadelphia",
  SF: "San Francisco",
  ATX: "Austin",
  "NYC/HKG": "New York/Hong Kong",
};

interface JaneStreetJob {
  id: number | string;
  position?: string;
  category?: string;
  availability?: string;
  city?: string;
  duration?: string;
  overview?: string;
  team?: string;
}

export const janeStreetAdapter: ScrapeAdapter = {
  source: {
    companySlug: "jane-street",
    companyName: "Jane Street",
    sourceType: "custom",
    adapterKey: "jane-street-custom",
    sourceUrl: SOURCE_URL,
  },
  async fetchPostings() {
    const [jobs, positionDirectories] = await Promise.all([
      fetchJson<JaneStreetJob[]>(JOBS_URL),
      fetchJson<string[]>(POSITION_DIRECTORIES_URL),
    ]);

    return parseJaneStreetJobs(jobs, new Set(positionDirectories));
  },
};

export function parseJaneStreetOpenRoles(html: string): NormalizedScrapedPosting[] {
  const postings = new Map<string, NormalizedScrapedPosting>();
  const linkPattern = /<a\b[^>]*href=["']([^"']*\/join-jane-street\/position\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = decodeHtml(match[1]);
    const rawTitle = cleanText(match[2]);
    if (!rawTitle || !isTargetEngineeringInternshipRole(rawTitle, surroundingText(html, match.index ?? 0))) continue;

    const postingUrl = new URL(href, BASE_URL).toString();
    const canonicalUrl = canonicalizePostingUrl(postingUrl);
    if (!canonicalUrl) continue;

    const context = surroundingText(html, match.index ?? 0);
    const locations = extractLocations(context);
    const normalizedLocations = normalizeLocations(locations);
    if (!isUsOnlyInternship(normalizedLocations.locations)) {
      continue;
    }
    const season = inferSeason(rawTitle, context);
    const roleName = normalizeRoleName(rawTitle);
    const hash = contentHash({
      roleName,
      canonicalUrl,
      locations: normalizedLocations.locations,
      season: season.season,
      seasonYear: season.seasonYear,
    });

    postings.set(canonicalUrl, {
      companySlug: "jane-street",
      companyName: "Jane Street",
      roleName,
      roleNameRaw: rawTitle,
      postingUrl,
      canonicalUrl,
      externalJobId: externalIdFromUrl(canonicalUrl),
      datePosted: null,
      datePostedSource: "unknown",
      season: season.season,
      seasonYear: season.seasonYear,
      seasonSource: season.seasonSource,
      ...normalizedLocations,
      contentHash: hash,
      metadata: { parser: "anchor-scan" },
    });
  }

  return Array.from(postings.values()).sort((a, b) => a.roleName.localeCompare(b.roleName));
}

export function parseJaneStreetJobs(
  jobs: JaneStreetJob[],
  visibleJobIds: Set<string>,
): NormalizedScrapedPosting[] {
  const postings = new Map<string, NormalizedScrapedPosting>();

  for (const job of jobs) {
    const rawTitle = cleanText(job.position ?? "");
    const availability = cleanText(job.availability ?? "");
    const duration = cleanText(job.duration ?? "");
    const description = cleanText(job.overview ?? "");
    if (
      !rawTitle ||
      !visibleJobIds.has(String(job.id)) ||
      !isEarlyCareerType(availability) ||
      !isTargetEngineeringInternshipRole(rawTitle, `${availability} ${duration} ${description}`)
    ) {
      continue;
    }

    const postingUrl = `${BASE_URL}/join-jane-street/position/${job.id}/`;
    const canonicalUrl = canonicalizePostingUrl(postingUrl);
    const locations = cityToLocations(job.city);
    const normalizedLocations = normalizeLocations(locations);
    if (!isUsOnlyInternship(normalizedLocations.locations)) {
      continue;
    }
    const season = inferSeason(`${rawTitle} ${duration}`, description);
    const roleName = normalizeRoleName(rawTitle);
    const hash = contentHash({
      roleName,
      canonicalUrl,
      locations: normalizedLocations.locations,
      season: season.season,
      seasonYear: season.seasonYear,
      availability,
      duration,
    });

    postings.set(canonicalUrl, {
      companySlug: "jane-street",
      companyName: "Jane Street",
      roleName,
      roleNameRaw: rawTitle,
      postingUrl,
      canonicalUrl,
      externalJobId: String(job.id),
      datePosted: null,
      datePostedSource: "unknown",
      season: season.season,
      seasonYear: season.seasonYear,
      seasonSource: season.seasonSource,
      ...normalizedLocations,
      contentHash: hash,
      metadata: {
        parser: "jobs-main-json",
        availability,
        duration,
        department: cleanText(job.category ?? ""),
        team: cleanText(job.team ?? ""),
      },
    });
  }

  return Array.from(postings.values()).sort((a, b) => a.roleName.localeCompare(b.roleName));
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "Pathway internship tracker dev scraper (+https://pathway.local)",
    },
  });
  if (!res.ok) throw new Error(`Jane Street returned ${res.status} for ${url}`);
  return await res.json() as T;
}

function cleanText(value: string): string {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}


function isEarlyCareerType(value: string): boolean {
  return /\b(internship|co-?op|industrial placement year)\b/i.test(value);
}

function surroundingText(html: string, index: number): string {
  const start = Math.max(0, index - 1200);
  const end = Math.min(html.length, index + 1800);
  return cleanText(html.slice(start, end));
}

function extractLocations(text: string): string[] {
  const out: string[] = [];
  for (const location of KNOWN_LOCATIONS) {
    if (new RegExp(`\\b${escapeRegExp(location)}\\b`, "i").test(text)) {
      out.push(location);
    }
  }
  return out;
}

function cityToLocations(city: string | undefined): string[] {
  const raw = cleanText(city ?? "");
  if (!raw) return [];
  return raw.split("/").map((part) => CITY_NAMES[part] ?? part).filter(Boolean);
}

function externalIdFromUrl(canonicalUrl: string): string | null {
  try {
    const path = new URL(canonicalUrl).pathname;
    const match = /\/position\/([^/]+)/i.exec(path);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
