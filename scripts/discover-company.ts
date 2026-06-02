import { createAdminClient } from "../lib/supabase/admin.ts";
import { runAllScrapes } from "../lib/scraping/run-all.ts";
import { loadDotEnvLocal } from "./discover-queue/env.ts";
import {
  parseDiscoverCompanyArgs,
  type DiscoverCompanyPlan,
} from "./discover-company/plan.ts";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printHelp();
  process.exit(0);
}

try {
  const plan = parseDiscoverCompanyArgs(process.argv.slice(2));

  if (!plan.apply) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "dry-run",
          plan,
          next: "Add --apply to write this company and source to hosted Supabase.",
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  loadDotEnvLocal();
  const result = await applyDiscoverCompanyPlan(plan);
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
} catch (error) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

type AdminClient = ReturnType<typeof createAdminClient>;

interface CompanyResult {
  id: string;
  slug: string;
  name: string;
}

interface SourceResult {
  id: string;
  source_type: string;
  adapter_key: string;
  enabled: boolean;
}

async function applyDiscoverCompanyPlan(plan: DiscoverCompanyPlan) {
  const supabase = createAdminClient();

  await assertIndustryExists(supabase, plan.company.industry);

  const company = await upsertCompany(supabase, plan);
  const source = await upsertCompanySource(supabase, company.id, plan);

  const scrape = plan.scrape
    ? await runAllScrapes({ filterSlug: plan.company.slug })
    : null;

  return {
    company,
    source,
    scrape,
  };
}

async function assertIndustryExists(supabase: AdminClient, industry: string) {
  const { data, error } = await supabase
    .from("discover_industries")
    .select("slug")
    .eq("slug", industry)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to validate industry: ${error.message}`);
  }
  if (!data) {
    throw new Error(`Unknown industry: ${industry}`);
  }
}

async function upsertCompany(
  supabase: AdminClient,
  plan: DiscoverCompanyPlan,
): Promise<CompanyResult> {
  const existing = await findCompanyBySlug(supabase, plan.company.slug);
  const timestamp = new Date().toISOString();

  if (existing) {
    const patch: Record<string, unknown> = {
      name: plan.company.name,
      industry: plan.company.industry,
      is_active: true,
      updated_at: timestamp,
    };
    if (plan.company.website_url) patch.website_url = plan.company.website_url;
    if (plan.company.careers_url) patch.careers_url = plan.company.careers_url;
    if (plan.company.logo_asset_key) patch.logo_asset_key = plan.company.logo_asset_key;

    const { data, error } = await supabase
      .from("companies")
      .update(patch)
      .eq("id", existing.id)
      .select("id, slug, name")
      .single();

    if (error) {
      throw new Error(`Failed to update company: ${error.message}`);
    }
    return data as CompanyResult;
  }

  const { data, error } = await supabase
    .from("companies")
    .insert({ ...plan.company, updated_at: timestamp })
    .select("id, slug, name")
    .single();

  if (error) {
    throw new Error(`Failed to insert company: ${error.message}`);
  }
  return data as CompanyResult;
}

async function findCompanyBySlug(
  supabase: AdminClient,
  slug: string,
): Promise<CompanyResult | null> {
  const { data, error } = await supabase
    .from("companies")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read company: ${error.message}`);
  }
  return (data as CompanyResult | null) ?? null;
}

async function upsertCompanySource(
  supabase: AdminClient,
  companyId: string,
  plan: DiscoverCompanyPlan,
): Promise<SourceResult> {
  const existing = await findMatchingSource(supabase, companyId, plan);
  const timestamp = new Date().toISOString();
  const payload = {
    company_id: companyId,
    ...plan.source,
    updated_at: timestamp,
  };

  if (existing) {
    const { data, error } = await supabase
      .from("company_sources")
      .update(payload)
      .eq("id", existing.id)
      .select("id, source_type, adapter_key, enabled")
      .single();

    if (error) {
      throw new Error(`Failed to update company source: ${error.message}`);
    }
    return data as SourceResult;
  }

  const { data, error } = await supabase
    .from("company_sources")
    .insert(payload)
    .select("id, source_type, adapter_key, enabled")
    .single();

  if (error) {
    throw new Error(`Failed to insert company source: ${error.message}`);
  }
  return data as SourceResult;
}

async function findMatchingSource(
  supabase: AdminClient,
  companyId: string,
  plan: DiscoverCompanyPlan,
): Promise<{ id: string } | null> {
  let query = supabase
    .from("company_sources")
    .select("id")
    .eq("company_id", companyId)
    .eq("source_type", plan.source.source_type)
    .eq("adapter_key", plan.source.adapter_key)
    .eq("source_url", plan.source.source_url)
    .limit(1);

  query =
    plan.source.board_token == null
      ? query.is("board_token", null)
      : query.eq("board_token", plan.source.board_token);

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(`Failed to read company source: ${error.message}`);
  }
  return (data as { id: string } | null) ?? null;
}

function printHelp() {
  console.log(`Usage:
  npm run discover-company -- --slug <slug> --name <name> --source-type <type> --source-url <url> [options]

Required:
  --slug <slug>             Lowercase company slug
  --name <name>             Display name
  --source-type <type>      Registered scraper source_type
  --source-url <url>        ATS or careers source URL

Options:
  --website <url>           Company website
  --careers <url>           Public careers page
  --industry <slug>         discover_industries slug (default: enterprise-software)
  --board-token <token>     ATS board token when needed
  --adapter-key <key>       Defaults to source-type
  --logo-asset-key <slug>   Set after adding public/company-logos/<slug>.png
  --disabled                Create the source disabled
  --apply                   Write to hosted Supabase; default is JSON dry-run
  --scrape                  After --apply, scrape this company immediately

Examples:
  npm run discover-company -- --slug acme --name Acme --source-type greenhouse --source-url https://job-boards.greenhouse.io/acme
  npm run discover-company -- --slug acme --name Acme --source-type greenhouse --source-url https://job-boards.greenhouse.io/acme --board-token acme --apply --scrape`);
}
