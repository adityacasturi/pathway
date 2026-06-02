import type { SupabaseClient } from "@supabase/supabase-js";
import type { MarketCatalogStats } from "@/lib/stats/market";
import type { MarketPulse, MarketWeekSummary } from "@/lib/home/briefing";
import { FEED_SEASONS, type FeedSeason } from "@/lib/feed/types";

interface MarketPostingSummaryRow {
  open_total: number | string | null;
  since_yesterday: number | string | null;
  remote_open: number | string | null;
  dominant_season: string | null;
  week_posted_count: number | string | null;
  week_remote_count: number | string | null;
  week_active_company_count: number | string | null;
  week_top_season: string | null;
  week_top_location_label: string | null;
  week_top_location_count: number | string | null;
  discover_companies: number | string | null;
  companies_with_open_roles: number | string | null;
}

export interface MarketPostingSummary {
  pulse: MarketPulse;
  week: MarketWeekSummary;
  catalog: MarketCatalogStats;
}

function toCount(value: number | string | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toSeason(value: string | null): FeedSeason | null {
  return value && (FEED_SEASONS as readonly string[]).includes(value)
    ? (value as FeedSeason)
    : null;
}

export function mapMarketPostingSummaryRow(row: MarketPostingSummaryRow): MarketPostingSummary {
  const topLocationCount = toCount(row.week_top_location_count);
  const topLocationLabel = row.week_top_location_label?.trim() || null;

  return {
    pulse: {
      openTotal: toCount(row.open_total),
      sinceYesterday: toCount(row.since_yesterday),
      remoteOpen: toCount(row.remote_open),
      dominantSeason: toSeason(row.dominant_season),
    },
    week: {
      postedCount: toCount(row.week_posted_count),
      remoteCount: toCount(row.week_remote_count),
      activeCompanyCount: toCount(row.week_active_company_count),
      topSeason: toSeason(row.week_top_season),
      topLocation:
        topLocationLabel && topLocationCount > 0
          ? { label: topLocationLabel, count: topLocationCount }
          : null,
    },
    catalog: {
      discoverCompanies: toCount(row.discover_companies),
      companiesWithOpenRoles: toCount(row.companies_with_open_roles),
    },
  };
}

export async function loadMarketPostingSummary(
  supabase: SupabaseClient,
  nowUnix?: number,
): Promise<MarketPostingSummary> {
  const args = nowUnix
    ? { _now: new Date(nowUnix * 1000).toISOString() }
    : undefined;
  const { data, error } = await supabase.rpc("market_posting_summary", args);

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error("market_posting_summary returned no rows");
  }
  return mapMarketPostingSummaryRow(row as MarketPostingSummaryRow);
}
