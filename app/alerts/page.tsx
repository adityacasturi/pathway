import { redirect } from "next/navigation";
import {
  AlertsPage,
  type CompanyAlertView,
  type SectorAlertView,
} from "@/components/alerts-page";
import { loadCuratedAlertSectors } from "@/lib/alerts/load-curated-sectors";
import { resolveSectorCompanies, type SectorCompanyDisplay } from "@/lib/alerts/curated-sectors";
import { loadDiscoverCompanies } from "@/lib/discover/companies";
import { loadDiscoverIndustryCatalog } from "@/lib/discover/catalog";
import { isAlertsLaunched } from "@/lib/config/alerts-launch";
import { assertSupabaseOk } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface SubscriptionRow {
  id: string;
  target_type: "company" | "sector";
  target_id: string;
}

export default async function AlertsRoute() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login?next=/alerts");

  const alertsLaunched = isAlertsLaunched();

  const industryCatalog = await loadDiscoverIndustryCatalog(supabase);
  const [companies, curatedAlertSectors, preferencesRes, subscriptionsRes] = await Promise.all([
    loadDiscoverCompanies(supabase, industryCatalog),
    loadCuratedAlertSectors(supabase),
    supabase.from("alert_preferences").select("emails_enabled, digest_enabled").maybeSingle(),
    supabase
      .from("alert_subscriptions")
      .select("id, target_type, target_id")
      .in("target_type", ["company", "sector"])
      .eq("cadence", "instant")
      .order("created_at", { ascending: true }),
  ]);

  assertSupabaseOk(preferencesRes.error, "Load alert preferences");
  assertSupabaseOk(subscriptionsRes.error, "Load alert subscriptions");

  const companyNameById = new Map(companies.map((company) => [company.id, company.name]));
  const companyWebsiteById = new Map(companies.map((company) => [company.id, company.websiteUrl]));
  const companySlugById = new Map(companies.map((company) => [company.id, company.slug]));
  const companiesBySlug = new Map<string, SectorCompanyDisplay>(
    companies.map((company) => [
      company.slug,
      { slug: company.slug, name: company.name, websiteUrl: company.websiteUrl },
    ]),
  );

  const rows = (subscriptionsRes.data ?? []) as SubscriptionRow[];
  const sectorAlerts: SectorAlertView[] = [];
  const companyAlerts: CompanyAlertView[] = [];

  for (const row of rows) {
    if (row.target_type === "sector") {
      sectorAlerts.push({ id: row.id, slug: row.target_id });
      continue;
    }
    companyAlerts.push({
      id: row.id,
      companyId: row.target_id,
      companySlug: companySlugById.get(row.target_id) ?? null,
      name: companyNameById.get(row.target_id) ?? "Company",
      websiteUrl: companyWebsiteById.get(row.target_id) ?? null,
    });
  }

  const curatedSectors = curatedAlertSectors.map((sector) => ({
    slug: sector.slug,
    label: sector.label,
    description: sector.description,
    companies: resolveSectorCompanies(sector, companiesBySlug),
  }));

  const subscriptionKey = rows.map((row) => row.id).join("|") || "empty";

  return (
    <AlertsPage
      key={subscriptionKey}
      userEmail={userData.user.email ?? ""}
      emailsEnabled={preferencesRes.data?.emails_enabled ?? false}
      digestEnabled={preferencesRes.data?.digest_enabled ?? false}
      sectorAlerts={sectorAlerts}
      companyAlerts={companyAlerts}
      curatedSectors={curatedSectors}
      companies={companies.map((company) => ({
        id: company.id,
        name: company.name,
        slug: company.slug,
        websiteUrl: company.websiteUrl,
        industryLabel: company.industryLabel,
      }))}
      previewMode={!alertsLaunched}
    />
  );
}
