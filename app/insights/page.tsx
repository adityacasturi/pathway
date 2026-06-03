import { redirect } from "next/navigation";
import { StatsPage } from "@/components/stats-page";
import { normalizeApplicationState } from "@/lib/config/application-state";
import { fetchFeed } from "@/lib/feed/source";
import { loadMarketPostingSummary } from "@/lib/feed/market-summary";
import { loadCompanyIndustryBySlug } from "@/lib/home/company-industry-map";
import { buildMarketStats } from "@/lib/stats/market";
import { assertSupabaseOk } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";
import type { Application } from "@/types/application";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const supabase = await createClient();

  // eslint-disable-next-line react-hooks/purity
  const nowUnix = Math.floor(Date.now() / 1000);

  const [userResult, appsResult, postings, marketSummary] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("applications")
      .select("*, application_events(*)")
      .order("created_at", { ascending: false }),
    fetchFeed(),
    loadMarketPostingSummary(supabase, nowUnix),
  ]);

  if (!userResult.data.user) redirect("/login?next=/insights");

  assertSupabaseOk(appsResult.error, "Load stats");

  const applications: Application[] = (appsResult.data ?? []).map((row) =>
    normalizeApplicationState({
      ...row,
      events: row.application_events ?? [],
      last_activity_date: row.created_at.slice(0, 10),
    }),
  );

  const industryBySlug = await loadCompanyIndustryBySlug(supabase);
  const market = buildMarketStats({
    postings,
    industryBySlug,
    discoverCompanyCount: marketSummary.catalog.discoverCompanies,
    nowUnix,
    summary: marketSummary,
  });

  return <StatsPage applications={applications} market={market} />;
}
