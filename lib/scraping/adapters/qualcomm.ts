import { createMicrosoftAdapter } from "./microsoft.ts";
import type { CompanySourceConfig, ScrapeAdapter } from "../types.ts";

/** Eightfold PCSX at careers.qualcomm.com (same API as apply.careers.microsoft.com). */
export const QUALCOMM_CAREERS_ORIGIN = "https://careers.qualcomm.com";
export const QUALCOMM_DEFAULT_DOMAIN = "qualcomm.com";

const QUALCOMM_CAREERS_HOST = "careers.qualcomm.com";

export function resolveQualcommSource(source: CompanySourceConfig): CompanySourceConfig {
  const boardToken = source.boardToken?.trim() || QUALCOMM_DEFAULT_DOMAIN;
  const sourceUrl = isQualcommCareersUrl(source.sourceUrl)
    ? source.sourceUrl
    : `${QUALCOMM_CAREERS_ORIGIN}/careers`;

  return {
    ...source,
    sourceUrl,
    boardToken,
  };
}

export function isQualcommCareersUrl(sourceUrl: string): boolean {
  try {
    return new URL(sourceUrl).hostname.toLowerCase() === QUALCOMM_CAREERS_HOST;
  } catch {
    return false;
  }
}

export function createQualcommAdapter(source: CompanySourceConfig): ScrapeAdapter {
  return createMicrosoftAdapter(resolveQualcommSource(source));
}
