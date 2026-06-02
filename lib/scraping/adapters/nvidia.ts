import { createWorkdayAdapter } from "./workday.ts";
import type { CompanySourceConfig, ScrapeAdapter } from "../types.ts";

/** Public Workday careers site (CXS JSON API). jobs.nvidia.com is Eightfold and not scrapeable. */
export const NVIDIA_WORKDAY_CAREERS_URL =
  "https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite";

export const NVIDIA_WORKDAY_SITE = "NVIDIAExternalCareerSite";

const NVIDIA_WORKDAY_HOST = "nvidia.wd5.myworkdayjobs.com";

export function resolveNvidiaWorkdaySource(source: CompanySourceConfig): CompanySourceConfig {
  const url = source.sourceUrl.trim();
  if (isNvidiaWorkdayCareersUrl(url)) {
    const boardToken = source.boardToken?.trim() || NVIDIA_WORKDAY_SITE;
    return boardToken === source.boardToken ? source : { ...source, boardToken };
  }

  return {
    ...source,
    sourceUrl: NVIDIA_WORKDAY_CAREERS_URL,
    boardToken: NVIDIA_WORKDAY_SITE,
  };
}

export function isNvidiaWorkdayCareersUrl(sourceUrl: string): boolean {
  try {
    return new URL(sourceUrl).hostname.toLowerCase() === NVIDIA_WORKDAY_HOST;
  } catch {
    return false;
  }
}

export function createNvidiaAdapter(source: CompanySourceConfig): ScrapeAdapter {
  return createWorkdayAdapter(resolveNvidiaWorkdaySource(source));
}
