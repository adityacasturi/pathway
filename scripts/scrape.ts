import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildScrapeAdapter } from "../lib/scraping/registry.ts";
import { runScrapeAdapter } from "../lib/scraping/upsert.ts";
import { createAdminClient } from "../lib/supabase/admin.ts";
import type { ScrapeAdapter, ScrapeSourceConfig, SourceType } from "../lib/scraping/types.ts";

loadDotEnvLocal();

const target = process.argv[2] ?? "";
if (!target || target === "--help" || target === "-h") {
  printUsage();
  process.exit(target ? 0 : 1);
}

const supabase = createAdminClient();

// Query all active company sources
const { data: dbSources, error: dbError } = await supabase
  .from("company_sources")
  .select(`
    id,
    source_type,
    adapter_key,
    source_url,
    board_token,
    enabled,
    companies (
      slug,
      name
    )
  `)
  .eq("enabled", true);

if (dbError) {
  console.error("Failed to load company sources from database:");
  console.error(dbError);
  process.exit(1);
}

interface CompanySourceRow {
  id: string;
  source_type: string;
  adapter_key: string;
  source_url: string;
  board_token: string | null;
  enabled: boolean;
  companies: {
    slug: string;
    name: string;
  } | null;
}

const rows = (dbSources ?? []) as unknown as CompanySourceRow[];
const adapters: ScrapeAdapter[] = [];

for (const row of rows) {
  const company = row.companies;
  if (!company) {
    console.warn(`Skipping source ${row.id} because associated company is missing`);
    continue;
  }

  const sourceConfig: ScrapeSourceConfig = {
    companySlug: company.slug,
    companyName: company.name,
    sourceType: row.source_type as SourceType,
    adapterKey: row.adapter_key,
    sourceUrl: row.source_url,
    boardToken: row.board_token || undefined,
  };

  const adapter = buildScrapeAdapter(sourceConfig);
  if (!adapter) {
    console.warn(
      `No adapter registered for ${company.slug} (${row.source_type} / ${row.adapter_key})`,
    );
  }

  if (adapter) {
    adapters.push(adapter);
  }
}

// Filter based on target command line arg
const selectedAdapters =
  target === "all"
    ? adapters
    : adapters.filter(
        (a) =>
          a.source.companySlug.toLowerCase() === target.toLowerCase() ||
          a.source.adapterKey.toLowerCase() === target.toLowerCase(),
      );

if (selectedAdapters.length === 0) {
  console.error(`No active scrape targets match: ${target}`);
  printUsage(adapters);
  process.exit(1);
}

let failures = 0;

for (const adapter of selectedAdapters) {
  try {
    const summary = await runScrapeAdapter(supabase, adapter);
    console.log(`${summary.company} scrape complete`);
    console.log(`Source: ${summary.source}`);
    console.log(`Found: ${summary.found}`);
    console.log(`Inserted: ${summary.inserted}`);
    console.log(`Updated: ${summary.updated}`);
    console.log(`Unchanged: ${summary.unchanged}`);
    console.log(`Marked stale: ${summary.markedStale}`);
  } catch (error) {
    failures += 1;
    console.error(`${adapter.source.companyName} scrape failed`);
    console.error(formatError(error));
  }
}

if (failures > 0) {
  process.exit(1);
}

function printUsage(available: ScrapeAdapter[] = []) {
  console.log("Usage: npm run scrape -- <target>");
  console.log("");
  console.log("Targets:");
  console.log("  all (Run all active targets)");
  if (available.length > 0) {
    for (const a of available) {
      console.log(`  ${a.source.companySlug} (${a.source.sourceType})`);
    }
  } else {
    console.log("  jane-street");
  }
}

function loadDotEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  let contents = "";
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    return;
  }

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) {
      continue;
    }
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) {
      continue;
    }
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }
  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}
