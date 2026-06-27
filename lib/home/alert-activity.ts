import { HOME_ACTIVITY_WINDOW_SECONDS } from "@/lib/home/briefing";
import { assertSupabaseOk } from "@/lib/supabase/errors";
import type { SupabaseClient } from "@supabase/supabase-js";

export const HOME_ALERT_ACTIVITY_POOL = 100;

export interface HomeAlertActivityRow {
  companyId: string;
  slug: string;
  name: string;
  websiteUrl: string | null;
  alertCount: number;
}

interface CompanyRow {
  id: string;
  slug: string;
  name: string;
  website_url: string | null;
}

interface SubscriptionRow {
  target_type: "company" | "sector";
  target_id: string;
  paused: boolean;
}

interface SentPostingRow {
  posting_id: string;
  scraped_postings:
    | { company_id: string }
    | Array<{ company_id: string }>
    | null;
}

interface SectorMemberRow {
  sector_slug: string;
  company_slug: string;
}

export function buildHomeAlertActivity(input: {
  subscriptions: SubscriptionRow[];
  companiesById: Map<string, CompanyRow>;
  sectorSlugsByCompanySlug: Map<string, Set<string>>;
  alertCountsByCompanyId: Map<string, number>;
}): HomeAlertActivityRow[] {
  const rowsByCompanyId = new Map<string, HomeAlertActivityRow>();

  function ensureCompany(companyId: string): HomeAlertActivityRow | null {
    const company = input.companiesById.get(companyId);
    if (!company) return null;

    const existing = rowsByCompanyId.get(companyId);
    if (existing) return existing;

    const row: HomeAlertActivityRow = {
      companyId: company.id,
      slug: company.slug,
      name: company.name,
      websiteUrl: company.website_url,
      alertCount: input.alertCountsByCompanyId.get(companyId) ?? 0,
    };
    rowsByCompanyId.set(companyId, row);
    return row;
  }

  for (const [companyId, count] of input.alertCountsByCompanyId) {
    if (count > 0) {
      ensureCompany(companyId);
    }
  }

  for (const subscription of input.subscriptions) {
    if (subscription.paused) continue;

    if (subscription.target_type === "company") {
      ensureCompany(subscription.target_id);
      continue;
    }

    for (const [companyId, count] of input.alertCountsByCompanyId) {
      if (count <= 0) continue;
      const company = input.companiesById.get(companyId);
      if (!company) continue;
      const sectors = input.sectorSlugsByCompanySlug.get(company.slug);
      if (!sectors?.has(subscription.target_id)) continue;
      ensureCompany(companyId);
    }
  }

  return [...rowsByCompanyId.values()]
    .sort((a, b) => b.alertCount - a.alertCount || a.name.localeCompare(b.name))
    .slice(0, HOME_ALERT_ACTIVITY_POOL);
}

export async function loadHomeAlertActivity(
  supabase: SupabaseClient,
  userId: string,
  nowUnix = Math.floor(Date.now() / 1000),
): Promise<HomeAlertActivityRow[]> {
  const sinceIso = new Date((nowUnix - HOME_ACTIVITY_WINDOW_SECONDS) * 1000).toISOString();

  const subscriptionsRes = await supabase
    .from("alert_subscriptions")
    .select("target_type, target_id, paused")
    .eq("user_id", userId)
    .in("target_type", ["company", "sector"]);

  assertSupabaseOk(subscriptionsRes.error, "Load home alert subscriptions");

  const subscriptions = (subscriptionsRes.data ?? []) as SubscriptionRow[];
  const activeSectorSlugs = [
    ...new Set(
      subscriptions
        .filter((row) => row.target_type === "sector" && !row.paused)
        .map((row) => row.target_id),
    ),
  ];

  const [sentRes, sectorMembersRes] = await Promise.all([
    supabase
      .from("alert_sent_postings")
      .select("posting_id, scraped_postings(company_id)")
      .eq("user_id", userId)
      .gte("sent_at", sinceIso),
    activeSectorSlugs.length > 0
      ? supabase
          .from("alert_curated_sector_companies")
          .select("sector_slug, company_slug")
          .in("sector_slug", activeSectorSlugs)
      : Promise.resolve({ data: [], error: null }),
  ]);

  assertSupabaseOk(sentRes.error, "Load home alert sent postings");
  assertSupabaseOk(sectorMembersRes.error, "Load home alert sector members");

  const alertCountsByCompanyId = new Map<string, number>();
  const seenPostingByCompany = new Map<string, Set<string>>();

  for (const row of (sentRes.data ?? []) as SentPostingRow[]) {
    const posting = Array.isArray(row.scraped_postings)
      ? row.scraped_postings[0]
      : row.scraped_postings;
    const companyId = posting?.company_id;
    if (!companyId) continue;

    let seen = seenPostingByCompany.get(companyId);
    if (!seen) {
      seen = new Set();
      seenPostingByCompany.set(companyId, seen);
    }
    if (seen.has(row.posting_id)) continue;
    seen.add(row.posting_id);

    alertCountsByCompanyId.set(companyId, (alertCountsByCompanyId.get(companyId) ?? 0) + 1);
  }

  const companyIds = new Set<string>([
    ...subscriptions
      .filter((row) => row.target_type === "company" && !row.paused)
      .map((row) => row.target_id),
    ...alertCountsByCompanyId.keys(),
  ]);

  if (companyIds.size === 0 && activeSectorSlugs.length === 0) {
    return [];
  }

  const sectorSlugsByCompanySlug = new Map<string, Set<string>>();
  for (const row of (sectorMembersRes.data ?? []) as SectorMemberRow[]) {
    let sectors = sectorSlugsByCompanySlug.get(row.company_slug);
    if (!sectors) {
      sectors = new Set();
      sectorSlugsByCompanySlug.set(row.company_slug, sectors);
    }
    sectors.add(row.sector_slug);
  }

  const companySlugsFromSectors = [...sectorSlugsByCompanySlug.keys()];

  const companiesById = new Map<string, CompanyRow>();
  if (companyIds.size > 0) {
    const byIdRes = await supabase
      .from("companies")
      .select("id, slug, name, website_url")
      .in("id", [...companyIds]);
    assertSupabaseOk(byIdRes.error, "Load home alert companies by id");
    for (const company of (byIdRes.data ?? []) as CompanyRow[]) {
      companiesById.set(company.id, company);
    }
  }

  const missingSectorSlugs = companySlugsFromSectors.filter(
    (slug) => ![...companiesById.values()].some((company) => company.slug === slug),
  );
  if (missingSectorSlugs.length > 0) {
    const bySlugRes = await supabase
      .from("companies")
      .select("id, slug, name, website_url")
      .in("slug", missingSectorSlugs);
    assertSupabaseOk(bySlugRes.error, "Load home alert companies by slug");
    for (const company of (bySlugRes.data ?? []) as CompanyRow[]) {
      companiesById.set(company.id, company);
    }
  }

  return buildHomeAlertActivity({
    subscriptions,
    companiesById,
    sectorSlugsByCompanySlug,
    alertCountsByCompanyId,
  });
}

function alertCountLabel(count: number): string {
  if (count === 1) return "1 role emailed this week";
  return `${count.toLocaleString()} roles emailed this week`;
}

export { alertCountLabel };
