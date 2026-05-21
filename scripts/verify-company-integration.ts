import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  findCompanySourceConfigs,
  hasCustomAdapterModule,
  toScrapeSourceConfig,
} from "../lib/scraping/integration-config.ts";
import { buildScrapeAdapter, CUSTOM_ADAPTER_REGISTRY } from "../lib/scraping/registry.ts";
import { runScrapeAdapter } from "../lib/scraping/upsert.ts";
import { createAdminClient } from "../lib/supabase/admin.ts";

loadDotEnvLocal();

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const slugs = args.filter((arg) => !arg.startsWith("--"));

const staticOnly = flags.has("--static");
const runScrape = flags.has("--scrape");
const minFound = Number.parseInt(process.env.VERIFY_MIN_FOUND ?? "1", 10);

if (slugs.length === 0 || flags.has("--help") || flags.has("-h")) {
  printUsage();
  process.exit(slugs.length === 0 ? 1 : 0);
}

let failures = 0;

for (const slug of slugs) {
  const result = await verifyCompany(slug);
  printReport(result);
  if (!result.ok) failures += 1;
}

process.exit(failures > 0 ? 1 : 0);

interface VerifyCheck {
  name: string;
  ok: boolean;
  detail: string;
}

interface VerifyReport {
  slug: string;
  ok: boolean;
  checks: VerifyCheck[];
}

async function verifyCompany(slug: string): Promise<VerifyReport> {
  const normalized = slug.trim().toLowerCase();
  const checks: VerifyCheck[] = [];
  const seeds = findCompanySourceConfigs(normalized);

  checks.push({
    name: "migration_source",
    ok: seeds.length > 0,
    detail:
      seeds.length > 0
        ? seeds.map((seed) => `${seed.migrationFile} (${seed.adapterKey})`).join(", ")
        : `No company_sources migration found for slug "${normalized}".`,
  });

  const scrapeRegistry = readFileSync(resolve(process.cwd(), "scripts/scrape.ts"), "utf8");
  checks.push({
    name: "scrape_registry",
    ok: scrapeRegistry.includes("lib/scraping/registry.ts"),
    detail: scrapeRegistry.includes("lib/scraping/registry.ts")
      ? "scripts/scrape.ts uses lib/scraping/registry.ts"
      : "scripts/scrape.ts must import adapters from lib/scraping/registry.ts",
  });

  if (seeds.length === 0) {
    return { slug: normalized, ok: false, checks };
  }

  const seed = seeds[seeds.length - 1];
  const source = toScrapeSourceConfig(seed);

  if (source.sourceType === "custom") {
    checks.push({
      name: "custom_adapter_registered",
      ok: CUSTOM_ADAPTER_REGISTRY.has(source.adapterKey),
      detail: CUSTOM_ADAPTER_REGISTRY.has(source.adapterKey)
        ? `Registered custom adapter "${source.adapterKey}"`
        : `Add "${source.adapterKey}" to CUSTOM_ADAPTER_REGISTRY in lib/scraping/registry.ts`,
    });
    checks.push({
      name: "custom_adapter_module",
      ok: hasCustomAdapterModule(normalized, source.adapterKey),
      detail: hasCustomAdapterModule(normalized, source.adapterKey)
        ? "Custom adapter module present"
        : `Expected lib/scraping/adapters/${normalized}.ts (or ${source.adapterKey}.ts)`,
    });
  }

  const unitTest = runUnitTestsForSlug();
  checks.push(unitTest);

  const adapter = buildScrapeAdapter(source);
  checks.push({
    name: "adapter_build",
    ok: adapter !== null,
    detail:
      adapter !== null
        ? `Built ${source.sourceType} adapter (${source.adapterKey})`
        : `Unable to build adapter for ${source.adapterKey}`,
  });

  if (staticOnly || adapter === null) {
    const ok = checks.every((check) => check.ok);
    return { slug: normalized, ok, checks };
  }

  try {
    const postings = await adapter.fetchPostings();
    checks.push({
      name: "live_fetch",
      ok: postings.length >= minFound,
      detail:
        postings.length >= minFound
          ? `Fetched ${postings.length} normalized posting(s)`
          : `Expected at least ${minFound} posting(s); got ${postings.length}`,
    });

    if (postings.length > 0) {
      const sample = postings
        .slice(0, 3)
        .map((posting) => `${posting.roleName} · ${posting.locations.join(", ")}`)
        .join(" | ");
      checks.push({
        name: "sample_postings",
        ok: true,
        detail: sample,
      });
    }
  } catch (error) {
    checks.push({
      name: "live_fetch",
      ok: false,
      detail: formatError(error),
    });
  }

  if (runScrape) {
    try {
      const supabase = createAdminClient();
      const summary = await runScrapeAdapter(supabase, adapter);
      checks.push({
        name: "supabase_scrape",
        ok: summary.found >= minFound,
        detail: `found=${summary.found} inserted=${summary.inserted} updated=${summary.updated}`,
      });
    } catch (error) {
      checks.push({
        name: "supabase_scrape",
        ok: false,
        detail: formatError(error),
      });
    }
  }

  const ok = checks.every((check) => check.ok);
  return { slug: normalized, ok, checks };
}

function runUnitTestsForSlug(): VerifyCheck {
  const result = spawnSync(
    process.execPath,
    [
      "--test",
      "--experimental-strip-types",
      "--experimental-specifier-resolution=node",
      "tests/unit/ats-adapters.test.ts",
      "tests/unit/scraping-normalize.test.ts",
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_OPTIONS: "",
      },
    },
  );

  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const ok = result.status === 0;
  return {
    name: "unit_tests",
    ok,
    detail: ok
      ? "Unit tests passed (ats-adapters + scraping-normalize)"
      : combined.split("\n").slice(-12).join("\n").trim() || `Unit tests failed (${result.status})`,
  };
}

function printReport(report: VerifyReport) {
  const status = report.ok ? "PASS" : "FAIL";
  console.log(`\n[${status}] ${report.slug}`);
  for (const check of report.checks) {
    const mark = check.ok ? "ok" : "x";
    console.log(`  ${mark} ${check.name}: ${check.detail}`);
  }
}

function printUsage() {
  console.log("Usage: npm run verify:integration -- <company-slug> [more-slugs] [flags]");
  console.log("");
  console.log("Flags:");
  console.log("  --static     File/registry checks only (no network)");
  console.log("  --scrape     Also upsert into Supabase (needs SUPABASE_SERVICE_ROLE_KEY)");
  console.log("");
  console.log("Env:");
  console.log("  VERIFY_MIN_FOUND=1   Minimum postings required for live/scrape checks");
  console.log("");
  console.log("Examples:");
  console.log("  npm run verify:integration -- amazon");
  console.log("  npm run verify:integration -- apple google --static");
  console.log("  npm run verify:integration -- nvidia --scrape");
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
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
