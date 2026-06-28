import type { GreenhouseBoardJob } from "../greenhouse-board.ts";
import type { CompanySourceConfig, ScrapeAdapter } from "../types.ts";
import { createFilteredGreenhouseAdapter } from "../greenhouse-filtered.ts";

/** X (Twitter) roles are listed on xAI's shared Greenhouse board after the merger. */
export const X_CORP_GREENHOUSE_API_URL =
  "https://boards-api.greenhouse.io/v1/boards/xai/jobs?content=true";
export const X_CORP_GREENHOUSE_BOARD_TOKEN = "xai";
export const X_CORP_CAREERS_URL = "https://x.ai/careers/open-roles";
export const X_CORP_GREENHOUSE_URL = "https://job-boards.greenhouse.io/xai";

/** Title/team markers for X platform roles on the shared xAI board (not pure xAI/Grok). */
const X_CORP_TITLE_PATTERN =
  /\b- x\b|\bx payments\b|\bx money\b|\bx core\b|\bx search\b|\bx api\b|\bx developer\b|^x\s/i;

export function isXCorpGreenhouseJob(job: GreenhouseBoardJob): boolean {
  const haystack = [
    job.title ?? "",
    job.content ?? "",
    ...(job.departments ?? []).map((department) => department.name ?? ""),
    ...(job.metadata ?? []).map((item) => String(item.value ?? "")),
  ]
    .join(" ")
    .toLowerCase();

  return X_CORP_TITLE_PATTERN.test(haystack);
}

export function createXCorpAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const resolvedSource =
    source.boardToken === X_CORP_GREENHOUSE_BOARD_TOKEN
      ? source
      : { ...source, boardToken: X_CORP_GREENHOUSE_BOARD_TOKEN };

  return createFilteredGreenhouseAdapter(resolvedSource, {
    apiUrl: X_CORP_GREENHOUSE_API_URL,
    deriveBoardToken: () => X_CORP_GREENHOUSE_BOARD_TOKEN,
    isRelevantJob: isXCorpGreenhouseJob,
  });
}
