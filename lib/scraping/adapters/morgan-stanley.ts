import { createMicrosoftAdapter } from "./microsoft.ts";
import type { CompanySourceConfig, ScrapeAdapter } from "../types.ts";

/** Eightfold PCSX at morganstanley.eightfold.ai (same API as apply.careers.microsoft.com). */
export const MORGAN_STANLEY_CAREERS_ORIGIN = "https://morganstanley.eightfold.ai";
export const MORGAN_STANLEY_DEFAULT_DOMAIN = "morganstanley.com";

const MORGAN_STANLEY_CAREERS_HOST = "morganstanley.eightfold.ai";

export function resolveMorganStanleySource(source: CompanySourceConfig): CompanySourceConfig {
  const boardToken = source.boardToken?.trim() || MORGAN_STANLEY_DEFAULT_DOMAIN;
  const sourceUrl = isMorganStanleyCareersUrl(source.sourceUrl)
    ? source.sourceUrl
    : `${MORGAN_STANLEY_CAREERS_ORIGIN}/careers`;

  return {
    ...source,
    sourceUrl,
    boardToken,
  };
}

export function isMorganStanleyCareersUrl(sourceUrl: string): boolean {
  try {
    return new URL(sourceUrl).hostname.toLowerCase() === MORGAN_STANLEY_CAREERS_HOST;
  } catch {
    return false;
  }
}

export function createMorganStanleyAdapter(source: CompanySourceConfig): ScrapeAdapter {
  return createMicrosoftAdapter(resolveMorganStanleySource(source));
}
