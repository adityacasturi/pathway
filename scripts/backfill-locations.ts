/**
 * Re-normalize scraped_postings locations using the geo pipeline.
 *
 *   npm run backfill:locations
 *   npm run backfill:locations -- --dry-run --limit 100
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createAdminClient } from "../lib/supabase/admin.ts";
import { canonicalPlacesToJson, resolveScrapedLocationField } from "../lib/geo/server.ts";

loadDotEnvLocal();

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number.parseInt(limitArg.split("=")[1] ?? "", 10) : null;
const progressEveryArg = args.find((arg) => arg.startsWith("--progress-every="));
const progressEvery = progressEveryArg
  ? Number.parseInt(progressEveryArg.split("=")[1] ?? "", 10)
  : 100;

const supabase = createAdminClient();

let query = supabase
  .from("scraped_postings")
  .select("id, location, posting_url")
  .eq("status", "open")
  .order("last_seen_at", { ascending: false });

if (limit && Number.isFinite(limit)) {
  query = query.limit(limit);
}

const { data, error } = await query;
if (error) {
  console.error(error.message);
  process.exit(1);
}

let updated = 0;
let unchanged = 0;
let scanned = 0;
const total = data?.length ?? 0;

console.log(
  `${dryRun ? "Dry run: " : ""}Backfilling locations for ${total.toLocaleString()} open postings${limit ? ` (limit ${limit.toLocaleString()})` : ""}...`,
);

for (const row of data ?? []) {
  scanned += 1;
  const raw = row.location?.trim() ?? "";
  if (!raw) {
    printProgress();
    continue;
  }

  const resolved = resolveScrapedLocationField(raw);
  const location = resolved.display;
  const location_places = canonicalPlacesToJson(resolved.places);
  const countries = resolved.countries;
  const location_confidence = resolved.places.length > 0 ? resolved.minConfidence : null;

  if (location === raw && location_places.length > 0) {
    unchanged += 1;
    printProgress();
    continue;
  }

  if (dryRun) {
    console.log(`${row.posting_url}\n  before: ${raw}\n  after:  ${location}\n`);
    updated += 1;
    printProgress();
    continue;
  }

  const { error: updateError } = await supabase
    .from("scraped_postings")
    .update({ location, location_places, countries, location_confidence })
    .eq("id", row.id);

  if (updateError) {
    if (updateError.message.includes("location_confidence")) {
      const { error: legacyError } = await supabase
        .from("scraped_postings")
        .update({ location, location_places, countries })
        .eq("id", row.id);
      if (legacyError) {
        console.error(legacyError.message);
        process.exit(1);
      }
    } else {
      console.error(updateError.message);
      process.exit(1);
    }
  }

  updated += 1;
  printProgress();
}

console.log(
  dryRun
    ? `Dry run: ${updated} would update, ${unchanged} unchanged (${data?.length ?? 0} scanned)`
    : `Updated ${updated} postings, ${unchanged} unchanged (${data?.length ?? 0} scanned)`,
);

function printProgress() {
  if (!Number.isFinite(progressEvery) || progressEvery <= 0) return;
  if (scanned < total && scanned % progressEvery !== 0) return;

  const percent = total > 0 ? Math.round((scanned / total) * 100) : 100;
  console.log(
    `Progress: ${scanned.toLocaleString()}/${total.toLocaleString()} (${percent}%) scanned, ${updated.toLocaleString()} ${dryRun ? "would update" : "updated"}, ${unchanged.toLocaleString()} unchanged`,
  );
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
