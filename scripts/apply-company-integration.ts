import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import type { ApplyReport } from "../lib/scraping/integration-apply.ts";
import {
  discoverAndApplyCompanyFromQueue,
  type DiscoverApplyReport,
} from "../lib/scraping/integration-discover.ts";
import { loadQueue } from "../lib/scraping/integration-queue.ts";

loadDotEnvLocal();

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const slugs = args.filter((arg) => !arg.startsWith("--"));

const commitDev = flags.has("--commit-dev");
const skipMigration = flags.has("--no-migration");
const runClaimed = flags.has("--claimed");

if (flags.has("--help") || flags.has("-h")) {
  printUsage();
  process.exit(0);
}

if (runClaimed) {
  const queue = loadQueue();
  const claimed = queue.companies.filter((company) => company.status === "in_progress");
  if (claimed.length === 0) {
    console.log("No in_progress companies to apply.");
    process.exit(0);
  }
  let failures = 0;
  for (const company of claimed) {
    const report = await applyOne(company.slug);
    if (!report.ok) failures += 1;
  }
  if (commitDev && failures === 0) {
    commitIntegrationFilesToDev();
  }
  process.exit(failures > 0 ? 1 : 0);
}

if (slugs.length === 0) {
  printUsage();
  process.exit(1);
}

let failures = 0;
for (const slug of slugs) {
  const report = await applyOne(slug);
  if (!report.ok) failures += 1;
}

if (commitDev && failures === 0) {
  commitIntegrationFilesToDev();
}

process.exit(failures > 0 ? 1 : 0);

async function applyOne(slug: string): Promise<ApplyReport | DiscoverApplyReport> {
  const report = await discoverAndApplyCompanyFromQueue(slug, { writeMigration: !skipMigration });
  printReport(report);
  return report;
}

function printReport(report: ApplyReport | DiscoverApplyReport) {
  const status = report.ok ? "PASS" : "FAIL";
  console.log(`\n[${status}] ${report.slug} (discover + Supabase apply)`);
  for (const step of report.steps) {
    const mark = step.ok ? "ok" : "x";
    console.log(`  ${mark} ${step.name}: ${step.detail}`);
  }
}

function commitIntegrationFilesToDev() {
  const add = spawnSync("git", ["add", "docs/company-integration-queue.json", "supabase/migrations"], {
    encoding: "utf8",
  });
  if (add.status !== 0) {
    console.error(add.stderr || add.stdout);
    return;
  }

  const status = spawnSync("git", ["diff", "--cached", "--quiet"], { encoding: "utf8" });
  if (status.status === 0) {
    console.log("No queue/migration changes to commit.");
    return;
  }

  const commit = spawnSync(
    "git",
    ["commit", "-m", "Apply company integrations to Supabase (automated queue update)"],
    { encoding: "utf8" },
  );
  if (commit.status !== 0) {
    console.error(commit.stderr || commit.stdout);
    return;
  }

  const push = spawnSync("git", ["push", "origin", "dev"], { encoding: "utf8" });
  if (push.status !== 0) {
    console.error(push.stderr || push.stdout);
    return;
  }
  console.log("Committed and pushed queue/migration updates to origin/dev.");
}

function printUsage() {
  console.log("Usage: npm run integration:apply -- <slug> [flags]");
  console.log("       npm run integration:apply -- --claimed [flags]");
  console.log("");
  console.log("Discovers ATS from each company careers page, then applies greenhouse/lever/ashby");
  console.log("to Supabase when verify passes. Blocks custom ATS. No pull request.");
  console.log("");
  console.log("Flags:");
  console.log("  --claimed       Apply all in_progress queue rows");
  console.log("  --no-migration  Skip writing supabase/migrations/*.sql");
  console.log("  --commit-dev    git commit + push queue/migrations to origin/dev (no PR)");
  console.log("");
  console.log("Requires: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL");
  console.log("");
  console.log("Examples:");
  console.log("  npm run integration:apply -- databricks");
  console.log("  npm run integration:apply -- --claimed --commit-dev");
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
