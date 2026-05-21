import { redirect } from "next/navigation";
import { SourcesPage, type CompanySourceSummary } from "@/components/sources-page";
import { isUsOnlyInternship } from "@/lib/postings/us-only";
import { assertSupabaseOk } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface SourceRow {
  id: string;
  enabled: boolean;
  last_success_at: string | null;
  consecutive_failures: number;
  last_error_code: string | null;
  companies: {
    id: string;
    name: string;
  } | null;
}

interface PostingCountRow {
  company_id: string;
  locations: string[] | null;
}

export default async function SourcesRoute() {
  const supabase = await createClient();
  const [userResult, sourcesResult, postingsResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("company_sources")
      .select(`
        id,
        enabled,
        last_success_at,
        consecutive_failures,
        last_error_code,
        companies (
          id,
          name
        )
      `)
      .eq("enabled", true)
      .order("id", { ascending: true }),
    supabase
      .from("postings")
      .select("company_id, locations")
      .in("status", ["open", "stale", "unknown"]),
  ]);

  if (!userResult.data.user) redirect("/");
  assertSupabaseOk(sourcesResult.error, "Load sources");
  assertSupabaseOk(postingsResult.error, "Load source posting counts");

  const countsByCompanyId = new Map<string, number>();
  for (const row of (postingsResult.data ?? []) as PostingCountRow[]) {
    if (!isUsOnlyInternship(row.locations ?? [])) continue;
    countsByCompanyId.set(row.company_id, (countsByCompanyId.get(row.company_id) ?? 0) + 1);
  }

  const sources = ((sourcesResult.data ?? []) as unknown as SourceRow[])
    .filter((source) => source.companies)
    .map((source): CompanySourceSummary => ({
      id: source.id,
      companyName: source.companies?.name ?? "",
      enabled: source.enabled,
      lastSuccessAt: source.last_success_at,
      consecutiveFailures: source.consecutive_failures,
      lastErrorCode: source.last_error_code,
      trackedInternships: source.companies
        ? countsByCompanyId.get(source.companies.id) ?? 0
        : 0,
    }))
    .sort(
      (a, b) =>
        b.trackedInternships - a.trackedInternships ||
        a.companyName.localeCompare(b.companyName),
    );

  return <SourcesPage sources={sources} />;
}
