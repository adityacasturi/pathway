import type { CompanySourceConfig, ScrapeAdapter } from "../types.ts";
import { createFilteredGreenhouseAdapter } from "../greenhouse-filtered.ts";

/** Replicate roles are on Cloudflare's Greenhouse board after joining Cloudflare. */
export const REPLICATE_GREENHOUSE_API_URL =
  "https://boards-api.greenhouse.io/v1/boards/cloudflare/jobs?content=true";
export const REPLICATE_CLOUDFLARE_BOARD_TOKEN = "cloudflare";
export const REPLICATE_CAREERS_URL = "https://replicate.com/about";
export const REPLICATE_CLOUDFLARE_GREENHOUSE_URL = "https://boards.greenhouse.io/cloudflare";

export function isReplicateGreenhouseJob(job: {
  title?: string;
  content?: string;
  departments?: Array<{ name?: string }>;
  metadata?: Array<{ name?: string; value?: string | null }>;
}): boolean {
  const haystack = [
    job.title ?? "",
    job.content ?? "",
    ...(job.departments ?? []).map((department) => department.name ?? ""),
    ...(job.metadata ?? []).map((item) => String(item.value ?? "")),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes("replicate");
}

export function createReplicateAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const resolvedSource =
    source.boardToken === REPLICATE_CLOUDFLARE_BOARD_TOKEN
      ? source
      : { ...source, boardToken: REPLICATE_CLOUDFLARE_BOARD_TOKEN };

  return createFilteredGreenhouseAdapter(resolvedSource, {
    apiUrl: REPLICATE_GREENHOUSE_API_URL,
    deriveBoardToken: () => REPLICATE_CLOUDFLARE_BOARD_TOKEN,
    isRelevantJob: isReplicateGreenhouseJob,
  });
}
