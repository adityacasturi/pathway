import type { CompanySourceConfig } from "../types.ts";

/**
 * RTX (Raytheon) careers use Workday CXS at globalhr.wd5 (REC_RTX_Ext_Gateway).
 * The public careers.rtx.com site is Phenom; job data is served from Workday.
 */
export const RTX_WORKDAY_CAREERS_URL =
  "https://globalhr.wd5.myworkdayjobs.com/en-US/REC_RTX_Ext_Gateway";

export const RTX_WORKDAY_SITE = "REC_RTX_Ext_Gateway";

const RTX_WORKDAY_HOST = "globalhr.wd5.myworkdayjobs.com";

const RTX_CAREERS_HOSTS = new Set(["careers.rtx.com", "www.rtx.com", "rtx.com"]);

export function resolveRtxWorkdaySource(source: CompanySourceConfig): CompanySourceConfig {
  const url = source.sourceUrl.trim();
  if (isRtxWorkdayCareersUrl(url)) {
    const boardToken = source.boardToken?.trim() || RTX_WORKDAY_SITE;
    return boardToken === source.boardToken ? source : { ...source, boardToken };
  }

  try {
    const host = new URL(url).hostname.toLowerCase();
    if (RTX_CAREERS_HOSTS.has(host) || host.endsWith(".rtx.com")) {
      return {
        ...source,
        sourceUrl: RTX_WORKDAY_CAREERS_URL,
        boardToken: RTX_WORKDAY_SITE,
      };
    }
  } catch {
    // fall through to default rewrite
  }

  return {
    ...source,
    sourceUrl: RTX_WORKDAY_CAREERS_URL,
    boardToken: RTX_WORKDAY_SITE,
  };
}

export function isRtxWorkdayCareersUrl(sourceUrl: string): boolean {
  try {
    return new URL(sourceUrl).hostname.toLowerCase() === RTX_WORKDAY_HOST;
  } catch {
    return false;
  }
}
