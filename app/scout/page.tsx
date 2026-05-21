import { redirect } from "next/navigation";
import { ScoutPostings } from "@/components/scout-postings";
import { normalizeCanonicalPosting } from "@/lib/postings/canonical";
import { isUsOnlyInternship } from "@/lib/postings/us-only";
import { assertSupabaseOk } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ScoutPage() {
  const supabase = await createClient();
  const [userResult, postingsResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("postings")
      .select("id, company_name, role_name, posting_url, date_posted, first_seen_at, season, season_year, locations, status")
      .in("status", ["open", "stale", "unknown"])
      .order("date_posted", { ascending: false, nullsFirst: false })
      .order("first_seen_at", { ascending: false })
      .limit(300),
  ]);

  if (!userResult.data.user) redirect("/");
  assertSupabaseOk(postingsResult.error, "Load scraped postings");

  const postings = (postingsResult.data ?? [])
    .filter((row) => isUsOnlyInternship(row.locations ?? []))
    .map(normalizeCanonicalPosting);

  return <ScoutPostings postings={postings} />;
}
