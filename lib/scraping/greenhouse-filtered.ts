import type { GreenhouseBoardJob } from "./greenhouse-board.ts";
import { parseGreenhouseJobs } from "./adapters/greenhouse.ts";
import { fetchJsonWithTimeout, resolveBoardToken } from "./adapters/shared.ts";
import type { CompanySourceConfig, ScrapeAdapter } from "./types.ts";

export interface FilteredGreenhouseAdapterOptions {
  /** Public boards API URL including `?content=true` when descriptions are needed. */
  apiUrl: string;
  deriveBoardToken: (source: CompanySourceConfig) => string;
  /** Keep only jobs relevant to this Discover company. */
  isRelevantJob: (job: GreenhouseBoardJob) => boolean;
}

/**
 * Greenhouse boards shared with other employers (Cloudflare hosts Replicate, etc.).
 * Uses standard {@link parseGreenhouseJobs} after a relevance filter.
 */
export function createFilteredGreenhouseAdapter(
  source: CompanySourceConfig,
  options: FilteredGreenhouseAdapterOptions,
): ScrapeAdapter {
  const boardToken = resolveBoardToken(source, () => options.deriveBoardToken(source));
  const resolvedSource = source.boardToken === boardToken ? source : { ...source, boardToken };

  return {
    source: resolvedSource,
    async fetchRoles() {
      const res = await fetchJsonWithTimeout(options.apiUrl);
      if (!res.ok) {
        throw new Error(`Greenhouse returned ${res.status} for ${options.apiUrl}`);
      }
      const payload = (await res.json()) as unknown;
      if (!payload || typeof payload !== "object" || !Array.isArray((payload as { jobs?: unknown }).jobs)) {
        throw new Error(`Greenhouse response was not in expected format for ${options.apiUrl}`);
      }
      const jobs = (payload as { jobs: GreenhouseBoardJob[] }).jobs.filter(options.isRelevantJob);
      return parseGreenhouseJobs(jobs, resolvedSource);
    },
  };
}
