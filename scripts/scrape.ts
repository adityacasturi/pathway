import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runAllScrapes } from "../lib/scraping/run-all.ts";
import type { ScrapeProgressEvent, SourceScrapeResult, SourceType } from "../lib/scraping/types.ts";

loadDotEnvLocal();

const cli = parseCliArgs(process.argv.slice(2));

if (cli.help) {
  printHelp();
  process.exit(0);
}

const startedAt = Date.now();
const companyMeta = new Map<string, CompanyRunMeta>();

const results = await runAllScrapes({
  filterSlug: cli.filterSlug,
  dryRun: cli.dryRun,
  onProgress: (event) => logScrapeProgress(event, companyMeta, cli.verbose, cli.dryRun),
});

printScrapeSummary(results, companyMeta, {
  dryRun: cli.dryRun,
  verbose: cli.verbose,
  filterSlug: cli.filterSlug,
  durationMs: Date.now() - startedAt,
});

const failed = results.filter((result) => result.status === "error");
process.exit(failed.length > 0 ? 1 : 0);

interface CompanyRunMeta {
  companyName: string;
  sourceType: SourceType;
  durationMs: number;
}

function parseCliArgs(args: string[]) {
  let filterSlug: string | undefined;
  let verbose = process.env.SCRAPER_VERBOSE === "1";
  let dryRun = false;
  let help = false;

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--verbose" || arg === "-v") {
      verbose = true;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (!arg.startsWith("-")) {
      const normalized = arg.trim().toLowerCase();
      if (normalized && normalized !== "all") {
        filterSlug = normalized;
      }
    }
  }

  return { filterSlug, verbose, dryRun, help };
}

function printHelp() {
  console.log("Usage: npm run scrape [--verbose|-v] [--dry-run] [company-slug|all]");
  console.log("");
  console.log("Options:");
  console.log("  --verbose, -v   Show adapter, slug, and per-role detail");
  console.log("  --dry-run       Fetch roles without writing to the database");
  console.log("  SCRAPER_VERBOSE=1   Same as --verbose");
  console.log("  SCRAPE_COMPANY_CONCURRENCY=8   Parallel companies (default 8, max 16)");
  console.log("");
  console.log("Examples:");
  console.log("  npm run scrape");
  console.log("  npm run scrape -- --verbose");
  console.log("  npm run scrape -- --dry-run palantir");
}

function logScrapeProgress(
  event: ScrapeProgressEvent,
  companyMeta: Map<string, CompanyRunMeta>,
  verbose: boolean,
  dryRun: boolean,
) {
  switch (event.type) {
    case "start": {
      const scope = event.filterSlug ? ` (${event.filterSlug})` : "";
      const mode = event.dryRun ? ", dry run" : "";
      if (event.total === 0) {
        console.log(`No companies to scrape${scope}${mode}.`);
        return;
      }
      console.log(`Scraping ${event.total} companies${scope}${mode}…`);
      console.log("");
      return;
    }
    case "begin":
      companyMeta.set(event.slug, {
        companyName: event.companyName,
        sourceType: event.sourceType,
        durationMs: 0,
      });
      return;
    case "done": {
      const seconds = (event.durationMs / 1000).toFixed(1);
      const { result } = event;
      const meta = companyMeta.get(result.slug);
      const companyName = meta?.companyName ?? result.slug;
      const sourceType = meta?.sourceType ?? "greenhouse";
      if (meta) {
        meta.durationMs = event.durationMs;
      }

      const label = verbose ? labelCompany(result.slug, companyName) : companyName;
      const prefix = `[${event.index}/${event.total}] ${label}`;

      if (result.status === "ok") {
        const roleCount = result.openCount;
        const action = dryRun ? "would save" : "saved";
        const stats = result.stats;
        const detail =
          verbose && stats
            ? `${roleCount} ${action} (${stats.fetched} fetched, ${stats.rejected.length} filtered out)`
            : `${roleCount} ${action}`;
        console.log(`${prefix}: ${detail} (${seconds}s)`);
        if (verbose) {
          console.log(`  ${sourceType} · ${result.slug}`);
          logKeptRolePreview(result);
        }
      } else {
        console.log(`${prefix}: failed — ${result.error ?? "unknown error"} (${seconds}s)`);
        if (verbose) {
          console.log(`  ${sourceType} · ${result.slug}`);
        }
      }
      return;
    }
  }
}

function logKeptRolePreview(result: SourceScrapeResult) {
  const preview = result.keptPreview;
  if (!preview || preview.length === 0) {
    return;
  }

  for (const role of preview) {
    const location = role.location ? ` · ${role.location}` : "";
    console.log(`  · ${role.title} (${role.season})${location}`);
  }
  const remaining = result.openCount - preview.length;
  if (remaining > 0) {
    console.log(`  · …${remaining} more`);
  }
}

function printScrapeSummary(
  results: SourceScrapeResult[],
  companyMeta: Map<string, CompanyRunMeta>,
  options: {
    dryRun: boolean;
    verbose: boolean;
    filterSlug?: string;
    durationMs: number;
  },
) {
  const succeeded = results.filter((result) => result.status === "ok");
  const failed = results.filter((result) => result.status === "error");
  const totalOpen = succeeded.reduce((sum, result) => sum + result.openCount, 0);

  console.log("");
  const filter = options.filterSlug ? ` · filter: ${options.filterSlug}` : "";
  const saved = options.dryRun ? "would save" : "saved";
  console.log(
    `Done in ${formatDuration(options.durationMs)}${filter} — ` +
      `${succeeded.length}/${results.length} ok · ${totalOpen} roles ${saved}`,
  );

  if (failed.length > 0) {
    console.log("");
    console.log(`${failed.length} failed:`);
    for (const result of sortByCompanyLabel(failed, companyMeta)) {
      const meta = companyMeta.get(result.slug);
      const name = meta?.companyName ?? result.slug;
      console.log(`  ${name}: ${result.error ?? "unknown error"}`);
    }
  }

  if (options.verbose) {
    const withRoles = succeeded.filter((result) => result.openCount > 0);
    const zeroRoles = succeeded.filter((result) => result.openCount === 0);
    const totalFetched = succeeded.reduce((sum, result) => sum + (result.stats?.fetched ?? 0), 0);
    const totalRejected = succeeded.reduce(
      (sum, result) => sum + (result.stats?.rejected.length ?? 0),
      0,
    );
    if (totalFetched > 0) {
      console.log("");
      console.log(`Fetched ${totalFetched} postings, filtered out ${totalRejected}.`);
    }

    if (withRoles.length > 0) {
      console.log("");
      console.log(`With roles (${withRoles.length}):`);
      for (const result of sortByOpenCountDesc(withRoles)) {
        const meta = companyMeta.get(result.slug);
        const label = labelCompany(result.slug, meta?.companyName);
        const stats = result.stats;
        const detail =
          stats != null
            ? `${result.openCount} saved · ${stats.fetched} fetched · ${stats.rejected.length} filtered`
            : `${result.openCount} saved`;
        console.log(`  ${label}: ${detail}`);
      }
    }

    if (zeroRoles.length > 0) {
      console.log("");
      console.log(`No roles (${zeroRoles.length}):`);
      for (const result of sortByCompanyLabel(zeroRoles, companyMeta)) {
        const meta = companyMeta.get(result.slug);
        const label = labelCompany(result.slug, meta?.companyName);
        const stats = result.stats;
        const detail =
          stats != null
            ? `${stats.fetched} fetched · ${stats.rejected.length} filtered`
            : "nothing returned";
        console.log(`  ${label}: ${detail}`);
      }
    }
  }
}

function labelCompany(slug: string, companyName?: string): string {
  if (companyName && companyName.trim().length > 0) {
    return `${companyName} (${slug})`;
  }
  return slug;
}

function sortByCompanyLabel(
  results: SourceScrapeResult[],
  companyMeta: Map<string, CompanyRunMeta>,
): SourceScrapeResult[] {
  return [...results].sort((a, b) => {
    const nameA = companyMeta.get(a.slug)?.companyName ?? a.slug;
    const nameB = companyMeta.get(b.slug)?.companyName ?? b.slug;
    return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
  });
}

function sortByOpenCountDesc(results: SourceScrapeResult[]): SourceScrapeResult[] {
  return [...results].sort((a, b) => b.openCount - a.openCount || a.slug.localeCompare(b.slug));
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function loadDotEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  try {
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env.local is optional for CI environments with injected env vars
  }
}
