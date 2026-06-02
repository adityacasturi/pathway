import assert from "node:assert/strict";
import test from "node:test";

import { mapMarketPostingSummaryRow } from "@/lib/feed/market-summary";

test("mapMarketPostingSummaryRow converts database aggregate rows", () => {
  const summary = mapMarketPostingSummaryRow({
    open_total: "572",
    since_yesterday: 54,
    remote_open: "16",
    dominant_season: "Summer",
    week_posted_count: "174",
    week_remote_count: 2,
    week_active_company_count: "25",
    week_top_season: "Fall",
    week_top_location_label: "San Jose",
    week_top_location_count: "69",
    discover_companies: "387",
    companies_with_open_roles: 98,
  });

  assert.deepEqual(summary.pulse, {
    openTotal: 572,
    sinceYesterday: 54,
    remoteOpen: 16,
    dominantSeason: "Summer",
  });
  assert.deepEqual(summary.week, {
    postedCount: 174,
    remoteCount: 2,
    activeCompanyCount: 25,
    topSeason: "Fall",
    topLocation: { label: "San Jose", count: 69 },
  });
  assert.deepEqual(summary.catalog, {
    discoverCompanies: 387,
    companiesWithOpenRoles: 98,
  });
});
