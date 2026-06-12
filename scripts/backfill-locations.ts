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
const includeClosed = args.includes("--include-closed");
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number.parseInt(limitArg.split("=")[1] ?? "", 10) : null;
const progressEveryArg = args.find((arg) => arg.startsWith("--progress-every="));
const progressEvery = progressEveryArg
  ? Number.parseInt(progressEveryArg.split("=")[1] ?? "", 10)
  : 100;

const supabase = createAdminClient();

// Page past PostgREST's 1000-row response cap.
const PAGE_SIZE = 1000;
type BackfillRow = {
  id: string;
  location: string | null;
  raw_location: string | null;
  posting_url: string;
};
const data: BackfillRow[] = [];

for (let offset = 0; ; offset += PAGE_SIZE) {
  let query = supabase
    .from("scraped_postings")
    .select("id, location, raw_location, posting_url")
    .order("last_seen_at", { ascending: false })
    .order("id", { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);

  if (!includeClosed) {
    query = query.eq("status", "open");
  }

  const { data: page, error } = await query;
  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  data.push(...((page ?? []) as BackfillRow[]));
  if (!page || page.length < PAGE_SIZE) break;
  if (limit && Number.isFinite(limit) && data.length >= limit) break;
}

if (limit && Number.isFinite(limit) && data.length > limit) {
  data.length = limit;
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
  // Prefer the original ATS string when present; otherwise the stored display
  // value is the best remaining record of what was scraped.
  const raw = row.raw_location?.trim() || row.location?.trim() || "";
  if (!raw) {
    printProgress();
    continue;
  }

  const resolved = resolveScrapedLocationField(raw);
  const location = resolved.display;
  const location_places = canonicalPlacesToJson(resolved.places);
  const countries = resolved.countries;
  const location_confidence = resolved.places.length > 0 ? resolved.minConfidence : null;
  const raw_location = row.raw_location?.trim() || row.location?.trim() || null;

  if (location === row.location && location_places.length > 0 && row.raw_location) {
    unchanged += 1;
    printProgress();
    continue;
  }

  if (dryRun) {
    console.log(`${row.posting_url}\n  before: ${row.location}\n  after:  ${location ?? "(unknown)"}\n`);
    updated += 1;
    printProgress();
    continue;
  }

  const { error: updateError } = await supabase
    .from("scraped_postings")
    .update({ location, location_places, countries, location_confidence, raw_location })
    .eq("id", row.id);

  if (updateError) {
    console.error(updateError.message);
    process.exit(1);
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
