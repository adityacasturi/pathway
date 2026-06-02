import { redirect } from "next/navigation";
import { StatsPage } from "@/components/stats-page";
import { normalizeApplicationState } from "@/lib/config/application-state";
import { fetchFeed } from "@/lib/feed/source";
import { loadCompanyIndustryBySlug } from "@/lib/home/company-industry-map";
import { buildMarketStats } from "@/lib/stats/market";
import { assertSupabaseOk } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";
import type { Application } from "@/types/application";

export const dynamic = "force-dynamic";

export default async function StatsRoute() {
  const supabase = await createClient();

  const [userResult, appsResult, postings, companyCountRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("applications")
      .select("*, application_events(*)")
      .order("created_at", { ascending: false }),
    fetchFeed(),
    supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
  ]);

  if (!userResult.data.user) redirect("/");

  assertSupabaseOk(appsResult.error, "Load stats");
  assertSupabaseOk(companyCountRes.error, "Load discover catalog count");

  const applications: Application[] = (appsResult.data ?? []).map((row) =>
    normalizeApplicationState({
      ...row,
      events: row.application_events ?? [],
      last_activity_date: row.created_at.slice(0, 10),
    }),
  );

  const industryBySlug = await loadCompanyIndustryBySlug(supabase);
  // eslint-disable-next-line react-hooks/purity
  const nowUnix = Math.floor(Date.now() / 1000);
  const market = buildMarketStats({
    postings,
    industryBySlug,
    discoverCompanyCount: companyCountRes.count ?? 0,
    nowUnix,
  });

  return <StatsPage applications={applications} market={market} />;
}
