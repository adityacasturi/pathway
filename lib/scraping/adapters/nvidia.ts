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

const CAREERS_BASE = "https://jobs.nvidia.com";
const SOURCE_URL = "https://www.nvidia.com/en-us/about-nvidia/careers/";
const SEARCH_API =
  "https://jobs.nvidia.com/api/pcsx/search?domain=nvidia.com";
const PAGE_SIZE = 10;
const SEARCH_QUERIES = ["intern", "co-op"] as const;

export interface NvidiaEightfoldPosition {
  id: number;
  displayJobId?: string;
  name: string;
  locations?: string[];
  postedTs?: number;
  department?: string;
  positionUrl?: string;
  workLocationOption?: string;
}

interface NvidiaSearchResponse {
  status?: number;
  data?: {
    positions?: NvidiaEightfoldPosition[];
    count?: number;
  };
}

export const nvidiaAdapter: ScrapeAdapter = {
  source: {
    companySlug: "nvidia",
    companyName: "NVIDIA",
    sourceType: "custom",
    adapterKey: "nvidia-eightfold",
    sourceUrl: SOURCE_URL,
  },
  async fetchPostings() {
    const positions = await fetchAllNvidiaPositions();
    return parseNvidiaPositions(positions, nvidiaAdapter.source);
  },
};

export function parseNvidiaPositions(
  positions: readonly NvidiaEightfoldPosition[],
  source: ScrapeSourceConfig,
): NormalizedScrapedPosting[] {
  const postings: NormalizedScrapedPosting[] = [];

  for (const position of positions) {
    const rawTitle = position.name?.trim() || "";
    const department = position.department?.trim() || "";
    const context = department ? `${department} ${rawTitle}` : rawTitle;
    if (!isTargetEngineeringInternshipRole(rawTitle, context)) {
      continue;
    }

    const postingUrl = resolvePostingUrl(position);
    const canonicalUrl = canonicalizePostingUrl(postingUrl);
    if (!canonicalUrl || !isHttpUrl(canonicalUrl)) {
      continue;
    }

    const normalizedLocations = normalizeLocations(position.locations ?? []);
    if (!isUsOnlyInternship(normalizedLocations.locations)) {
      continue;
    }

    const season = inferSeason(rawTitle, context);
    const roleName = normalizeRoleName(rawTitle);
    const datePosted = safeToIsoDate(
      position.postedTs ? position.postedTs * 1000 : null,
    );
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
      externalJobId: position.displayJobId?.trim() || (position.id ? String(position.id) : null),
      datePosted,
      datePostedSource: datePosted ? "ats" : "unknown",
      season: season.season,
      seasonYear: season.seasonYear,
      seasonSource: season.seasonSource,
      ...normalizedLocations,
      contentHash: hash,
      metadata: {
        parser: "nvidia-eightfold",
        department: department || undefined,
        displayJobId: position.displayJobId,
        workLocationOption: position.workLocationOption,
      },
    });
  }

  return dedupePostingsByCanonicalUrl(postings);
}

async function fetchAllNvidiaPositions(): Promise<NvidiaEightfoldPosition[]> {
  const byId = new Map<number, NvidiaEightfoldPosition>();

  for (const query of SEARCH_QUERIES) {
    let start = 0;
    let total = Number.POSITIVE_INFINITY;

    while (start < total) {
      const url = `${SEARCH_API}&query=${encodeURIComponent(query)}&location=&start=${start}&num=${PAGE_SIZE}`;
      const res = await fetch(url, { headers: atsJsonHeaders() });
      if (!res.ok) {
        throw new Error(`NVIDIA careers API returned ${res.status} for ${url}`);
      }

      const payload = (await res.json()) as NvidiaSearchResponse;
      const positions = payload.data?.positions ?? [];
      total = payload.data?.count ?? positions.length;

      for (const position of positions) {
        byId.set(position.id, position);
      }

      if (positions.length === 0) {
        break;
      }
      start += PAGE_SIZE;
    }
  }

  return Array.from(byId.values());
}

function resolvePostingUrl(position: NvidiaEightfoldPosition): string {
  const path = position.positionUrl?.trim();
  if (path) {
    return new URL(path, CAREERS_BASE).toString();
  }
  return `${CAREERS_BASE}/careers/job/${position.id}`;
}
