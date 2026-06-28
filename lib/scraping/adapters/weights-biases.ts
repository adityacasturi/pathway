import type { GreenhouseBoardJob } from "../greenhouse-board.ts";
import type { CompanySourceConfig, ScrapeAdapter } from "../types.ts";
import { createFilteredGreenhouseAdapter } from "../greenhouse-filtered.ts";

/** W&B listings live on CoreWeave's Greenhouse board after the acquisition. */
export const WEIGHTS_BIASES_GREENHOUSE_API_URL =
  "https://boards-api.greenhouse.io/v1/boards/coreweave/jobs?content=true";
export const WEIGHTS_BIASES_COREWEAVE_BOARD_TOKEN = "coreweave";
export const WEIGHTS_BIASES_CAREERS_URL = "https://www.coreweave.com/careers/weights-biases";

export function isWeightsBiasesGreenhouseJob(job: GreenhouseBoardJob): boolean {
  for (const item of job.metadata ?? []) {
    const label = item.name?.trim().toLowerCase() ?? "";
    const value = typeof item.value === "string" ? item.value.trim() : "";
    if (label === "acquisition company" && value === "Weights & Biases") {
      return true;
    }
  }
  return false;
}

export function createWeightsBiasesAdapter(source: CompanySourceConfig): ScrapeAdapter {
  const resolvedSource =
    source.boardToken === WEIGHTS_BIASES_COREWEAVE_BOARD_TOKEN
      ? source
      : { ...source, boardToken: WEIGHTS_BIASES_COREWEAVE_BOARD_TOKEN };

  return createFilteredGreenhouseAdapter(resolvedSource, {
    apiUrl: WEIGHTS_BIASES_GREENHOUSE_API_URL,
    deriveBoardToken: () => WEIGHTS_BIASES_COREWEAVE_BOARD_TOKEN,
    isRelevantJob: isWeightsBiasesGreenhouseJob,
  });
}
