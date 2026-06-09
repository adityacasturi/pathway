/**
 * Dry-run all enabled company scrapers and summarize keep quality by source_type.
 *
 *   npm run scrape:audit
 *   npm run scrape:audit -- amazon neuralink
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runAllScrapes } from "../lib/scraping/run-all.ts";
import type { SourceType } from "../lib/scraping/types.ts";

loadDotEnvLocal();

const filterSlugs = process.argv
  .slice(2)
  .map((arg) => arg.trim().toLowerCase())
  .filter((arg) => arg && !arg.startsWith("-"));

const filterSlug = filterSlugs.length === 1 ? filterSlugs[0] : undefined;

if (filterSlugs.length > 1) {
  console.error("Pass zero or one company slug filter.");
  process.exit(1);
}

const companyMeta = new Map<string, { sourceType: SourceType }>();

const results = await runAllScrapes({
  filterSlug,
  dryRun: true,
  onProgress: (event) => {
    if (event.type === "begin") {
      companyMeta.set(event.slug, { sourceType: event.sourceType });
    }
  },
});

const byType = new Map<
  SourceType,
  {
    companies: number;
    errors: number;
    fetched: number;
    kept: number;
  }
>();

for (const result of results) {
  const sourceType = companyMeta.get(result.slug)?.sourceType ?? "greenhouse";
  const bucket = byType.get(sourceType) ?? {
    companies: 0,
    errors: 0,
    fetched: 0,
    kept: 0,
  };

  bucket.companies += 1;
  if (result.status === "error") {
    bucket.errors += 1;
    byType.set(sourceType, bucket);
    continue;
  }

  bucket.fetched += result.stats?.fetched ?? 0;
  bucket.kept += result.stats?.kept ?? 0;
  byType.set(sourceType, bucket);
}

const rows = [...byType.entries()].sort((a, b) => b[1].kept - a[1].kept);

console.log(
  filterSlug
    ? `Scrape quality audit (dry-run) — ${filterSlug}\n`
    : "Scrape quality audit (dry-run) — all enabled companies\n",
);

console.log(
  "source_type".padEnd(22),
  "cos".padStart(5),
  "err".padStart(5),
  "fetch".padStart(7),
  "kept".padStart(7),
);
console.log("-".repeat(48));

for (const [sourceType, stats] of rows) {
  console.log(
    sourceType.padEnd(22),
    String(stats.companies).padStart(5),
    String(stats.errors).padStart(5),
    String(stats.fetched).padStart(7),
    String(stats.kept).padStart(7),
  );
}

const failed = results.filter((r) => r.status === "error");
if (failed.length > 0) {
  console.log("\nFailures:");
  for (const result of failed) {
    console.log(`  ${result.slug}: ${result.error}`);
  }
}

process.exit(failed.length > 0 ? 1 : 0);

function loadDotEnvLocal() {
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // optional local env
  }
}
