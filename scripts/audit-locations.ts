/**
 * Summarize location normalization quality for open scraped postings.
 *
 *   npm run scrape:audit-locations
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createAdminClient } from "../lib/supabase/admin.ts";

loadDotEnvLocal();

const baselinePath = resolve(process.cwd(), "tests/fixtures/location-confidence-baseline.json");
const failOnRegression = process.argv.includes("--check");

const supabase = createAdminClient();

const { data, error } = await supabase
  .from("scraped_postings")
  .select("id, location, location_confidence, location_places, company_name")
  .eq("status", "open");

if (error) {
  console.error(error.message);
  process.exit(1);
}

const rows = data ?? [];
const withPlaces = rows.filter((row) => Array.isArray(row.location_places) && row.location_places.length > 0);
const highConfidence = rows.filter((row) => (row.location_confidence ?? 0) >= 80);
const rate = rows.length > 0 ? highConfidence.length / rows.length : 1;
const placesRate = rows.length > 0 ? withPlaces.length / rows.length : 1;

console.log(`Open postings: ${rows.length}`);
console.log(`With location_places: ${withPlaces.length} (${(placesRate * 100).toFixed(1)}%)`);
console.log(`location_confidence >= 80: ${highConfidence.length} (${(rate * 100).toFixed(1)}%)`);

const patterns = new Map<string, number>();
for (const row of rows) {
  const key = (row.location ?? "").trim().toLowerCase();
  if (!key) continue;
  patterns.set(key, (patterns.get(key) ?? 0) + 1);
}

const topPatterns = [...patterns.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20);

console.log("\nTop location patterns:");
for (const [pattern, count] of topPatterns) {
  console.log(`  ${count}x ${pattern}`);
}

const snapshot = {
  generatedAt: new Date().toISOString(),
  openCount: rows.length,
  placesRate,
  highConfidenceRate: rate,
};

if (failOnRegression) {
  let baseline: { highConfidenceRate?: number; placesRate?: number };
  try {
    baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as typeof snapshot;
  } catch {
    console.error(`Missing baseline ${baselinePath}; run without --check to generate.`);
    process.exit(1);
  }

  const confidenceDrop = (baseline.highConfidenceRate ?? 1) - rate;
  const placesDrop = (baseline.placesRate ?? 1) - placesRate;
  if (confidenceDrop > 0.02 || placesDrop > 0.02) {
    console.error(
      `\nRegression: confidence -${(confidenceDrop * 100).toFixed(1)}pp, places -${(placesDrop * 100).toFixed(1)}pp`,
    );
    process.exit(1);
  }
  console.log("\nBaseline check passed.");
} else {
  writeFileSync(baselinePath, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`\nWrote baseline ${baselinePath}`);
}

function loadDotEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  try {
    const content = readFileSync(path, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional
  }
}
