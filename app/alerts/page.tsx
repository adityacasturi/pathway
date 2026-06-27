import { redirect } from "next/navigation";
import { pageMetadata } from "@/lib/metadata/page";

export const metadata = pageMetadata("Alerts", "Email alerts for new roles at companies and industries you follow.");
import { AlertsPage } from "@/components/alerts/alerts-page";
import type { AlertSubscriptionView } from "@/components/alerts/types";
import {
  getCachedCuratedAlertSectors,
  getCachedDiscoverCompanies,
} from "@/lib/cache/catalog";
import { resolveSectorCompanies, type SectorCompanyDisplay } from "@/lib/alerts/curated-sectors";
import { alertFiltersFromPreferenceRow, parseFilterOverrideJson } from "@/lib/alerts/filters";
import { assertSupabaseOk } from "@/lib/supabase/errors";
import { getAuthenticatedUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

interface SubscriptionRow {
  id: string;
  target_type: "company" | "sector";
  target_id: string;
  cadence: "instant";
  filter_override: Record<string, unknown> | null;
  paused: boolean;
}

export default async function AlertsRoute() {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) redirect("/login?next=/alerts");
  const userId = user.id;

  const [companies, curatedAlertSectors, preferencesRes, subscriptionsRes] = await Promise.all([
    getCachedDiscoverCompanies(),
    getCachedCuratedAlertSectors(),
    supabase
      .from("alert_preferences")
      .select("emails_enabled, alert_seasons, alert_countries, alert_include_remote")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("alert_subscriptions")
      .select("id, target_type, target_id, cadence, filter_override, paused")
      .eq("user_id", userId)
      .in("target_type", ["company", "sector"])
      .order("created_at", { ascending: true }),
  ]);

  assertSupabaseOk(preferencesRes.error, "Load alert preferences");
  assertSupabaseOk(subscriptionsRes.error, "Load alert subscriptions");

  const globalFilters = alertFiltersFromPreferenceRow(preferencesRes.data);

  const companyNameById = new Map(companies.map((company) => [company.id, company.name]));
  const companyWebsiteById = new Map(companies.map((company) => [company.id, company.websiteUrl]));
  const companySlugById = new Map(companies.map((company) => [company.id, company.slug]));
  const companiesBySlug = new Map<string, SectorCompanyDisplay>(
    companies.map((company) => [
      company.slug,
      { slug: company.slug, name: company.name, websiteUrl: company.websiteUrl },
    ]),
  );

  const sectorBySlug = new Map(
    curatedAlertSectors.map((sector) => [
      sector.slug,
      {
        label: sector.label,
        companies: resolveSectorCompanies(sector, companiesBySlug),
      },
    ]),
  );

  const rows = (subscriptionsRes.data ?? []) as SubscriptionRow[];
  const subscriptions: AlertSubscriptionView[] = [];

  for (const row of rows) {
    const filterOverride = parseFilterOverrideJson(
      row.filter_override as Parameters<typeof parseFilterOverrideJson>[0],
    );

    if (row.target_type === "sector") {
      const sector = sectorBySlug.get(row.target_id);
      subscriptions.push({
        id: row.id,
        type: "sector",
        label: sector?.label ?? row.target_id,
        companyId: null,
        companySlug: null,
        sectorSlug: row.target_id,
        websiteUrl: null,
        sectorCompanies: sector?.companies ?? [],
        filterOverride,
        paused: row.paused,
      });
      continue;
    }

    subscriptions.push({
      id: row.id,
      type: "company",
      label: companyNameById.get(row.target_id) ?? "Company",
      companyId: row.target_id,
      companySlug: companySlugById.get(row.target_id) ?? null,
      sectorSlug: null,
      websiteUrl: companyWebsiteById.get(row.target_id) ?? null,
      filterOverride,
      paused: row.paused,
    });
  }

  const curatedSectors = curatedAlertSectors.map((sector) => ({
    slug: sector.slug,
    label: sector.label,
    description: sector.description,
    groupLabel: sector.groupLabel,
    groupSortOrder: sector.groupSortOrder,
    companies: resolveSectorCompanies(sector, companiesBySlug),
  }));

  return (
    <AlertsPage
      globalFilters={globalFilters}
      subscriptions={subscriptions}
      curatedSectors={curatedSectors}
      companies={companies.map((company) => ({
        id: company.id,
        name: company.name,
        slug: company.slug,
        websiteUrl: company.websiteUrl,
        industryLabel: company.industryLabel,
      }))}
    />
  );
}
