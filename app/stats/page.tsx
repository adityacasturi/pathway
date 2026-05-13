import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeApplicationState } from "@/lib/config/application-state";
import { assertSupabaseOk } from "@/lib/supabase/errors";
import { StatsPage } from "@/components/stats-page";
import type { Application } from "@/types/application";

export default async function StatsRoute() {
  const supabase = await createClient();

  const [userResult, appsResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("applications")
      .select("*, application_events(*)")
      .order("created_at", { ascending: false }),
  ]);

  if (!userResult.data.user) redirect("/");
  assertSupabaseOk(appsResult.error, "Load stats");

  const applications: Application[] = (appsResult.data ?? []).map((row) =>
    normalizeApplicationState({
      ...row,
      events: row.application_events ?? [],
      last_activity_date: row.created_at.slice(0, 10),
    }),
  );

  return <StatsPage applications={applications} />;
}
