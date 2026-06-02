import type { FeedPosting } from "../feed/types.ts";
import {
  buildHotCompanies,
  buildIndustrySpotlight,
  buildMarketPulse,
  buildMarketWeekSummary,
  parseCompanySlug,
  type HotCompany,
  type IndustryActivity,
  type MarketPulse,
  type MarketWeekSummary,
} from "../home/briefing.ts";
import type { CompanyIndustryInfo } from "../home/briefing.ts";
import type { MarketPostingSummary } from "../feed/market-summary.ts";

export const STATS_MAX_HOT_COMPANIES = 5;
export const STATS_MAX_INDUSTRY_ROWS = 5;

export interface MarketCatalogStats {
  discoverCompanies: number;
  companiesWithOpenRoles: number;
}

export interface MarketStats {
  pulse: MarketPulse;
  week: MarketWeekSummary;
  catalog: MarketCatalogStats;
  hotCompanies: HotCompany[];
  industries: IndustryActivity[];
  catalogHiringRate: number | null;
  avgOpenRolesPerCompany: number | null;
}

export interface BuildMarketStatsInput {
  postings: FeedPosting[];
  industryBySlug: ReadonlyMap<string, CompanyIndustryInfo>;
  discoverCompanyCount: number;
  nowUnix?: number;
  summary?: MarketPostingSummary;
}

function countCompaniesWithOpenRoles(postings: FeedPosting[]): number {
  const slugs = new Set<string>();
  for (const posting of postings) {
    const slug = parseCompanySlug(posting.sourceId);
    if (slug) slugs.add(slug);
  }
  return slugs.size;
}

function catalogHiringRate(
  companiesWithOpenRoles: number,
  discoverCompanies: number,
): number | null {
  if (discoverCompanies <= 0) return null;
  return Math.round((companiesWithOpenRoles / discoverCompanies) * 100);
}

function avgOpenRolesPerCompany(openTotal: number, companiesWithOpenRoles: number): number | null {
  if (companiesWithOpenRoles <= 0) return null;
  return Math.round((openTotal / companiesWithOpenRoles) * 10) / 10;
}

export function buildMarketStats(input: BuildMarketStatsInput): MarketStats {
  const nowUnix = input.nowUnix ?? Math.floor(Date.now() / 1000);
  const companiesWithOpenRoles =
    input.summary?.catalog.companiesWithOpenRoles ?? countCompaniesWithOpenRoles(input.postings);
  const openTotal = input.postings.length;
  const catalog = input.summary?.catalog ?? {
    discoverCompanies: input.discoverCompanyCount,
    companiesWithOpenRoles,
  };

  return {
    pulse: input.summary?.pulse ?? buildMarketPulse(input.postings, nowUnix),
    week: input.summary?.week ?? buildMarketWeekSummary(input.postings, nowUnix),
    catalog,
    hotCompanies: buildHotCompanies(input.postings, {
      nowUnix,
      limit: STATS_MAX_HOT_COMPANIES,
    }),
    industries: buildIndustrySpotlight(input.postings, input.industryBySlug, {
      nowUnix,
      limit: STATS_MAX_INDUSTRY_ROWS,
    }),
    catalogHiringRate: catalogHiringRate(
      companiesWithOpenRoles,
      catalog.discoverCompanies,
    ),
    avgOpenRolesPerCompany: avgOpenRolesPerCompany(openTotal, companiesWithOpenRoles),
  };
}
