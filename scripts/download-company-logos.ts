/**
 * Download company logos from logo.dev into public/company-logos/{slug}.png
 * and regenerate lib/logo/static-slug-manifest.json.
 *
 * Usage:
 *   npm run company-logos              # all active companies (skip existing)
 *   npm run company-logos -- --slug google --force
 *   npm run company-logos -- --manifest-only
 *
 * Requires LOGO_DEV_TOKEN and SUPABASE_SERVICE_ROLE_KEY in .env.local (for --from-db).
 */
import { createAdminClient } from "../lib/supabase/admin.ts";
import {
  COMPANY_LOGOS_DIR,
  downloadCompanyLogoFile,
  writeStaticSlugManifest,
  type CompanyLogoDownloadEntry,
  type DownloadLogoResult,
} from "../lib/logo/download.ts";
import { loadDotEnvLocal } from "./discover-queue/env.ts";

const DEFAULT_CONCURRENCY = 3;
const START_GAP_MS = 80;

loadDotEnvLocal();

type CompanyRow = {
  slug: string;
  name: string;
  website_url: string | null;
};

function parseArgs(argv: string[]) {
  let slug: string | null = null;
  let force = false;
  let manifestOnly = false;
  let concurrency = DEFAULT_CONCURRENCY;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--slug" && argv[i + 1]) {
      slug = argv[++i]!.trim().toLowerCase();
    } else if (arg === "--force") {
      force = true;
    } else if (arg === "--manifest-only") {
      manifestOnly = true;
    } else if (arg === "--concurrency" && argv[i + 1]) {
      concurrency = Math.max(1, Number.parseInt(argv[++i]!, 10) || DEFAULT_CONCURRENCY);
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: npm run company-logos [-- --slug <slug>] [--force] [--manifest-only]`);
      process.exit(0);
    }
  }

  return { slug, force, manifestOnly, concurrency };
}

async function loadCompanies(filterSlug: string | null): Promise<CompanyLogoDownloadEntry[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("companies")
    .select("slug, name, website_url")
    .eq("is_active", true)
    .order("slug");

  if (filterSlug) {
    query = query.eq("slug", filterSlug);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as CompanyRow[]).map((row) => ({
    slug: row.slug.trim().toLowerCase(),
    name: row.name.trim(),
    websiteUrl: row.website_url?.trim() ?? null,
  }));
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  gapMs: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  let lastStart = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;

      const elapsed = Date.now() - lastStart;
      if (elapsed < gapMs) {
        await new Promise((r) => setTimeout(r, gapMs - elapsed));
      }
      lastStart = Date.now();

      results[index] = await fn(items[index]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

async function main() {
  const { slug, force, manifestOnly, concurrency } = parseArgs(process.argv.slice(2));

  if (manifestOnly) {
    const slugs = await writeStaticSlugManifest();
    console.log(`Wrote manifest (${slugs.length} slugs)`);
    return;
  }

  const token = process.env.LOGO_DEV_TOKEN?.trim();
  if (!token) {
    console.error("LOGO_DEV_TOKEN is required");
    process.exit(1);
  }

  const companies = await loadCompanies(slug);
  if (companies.length === 0) {
    console.error(slug ? `No active company for slug: ${slug}` : "No active companies found");
    process.exit(1);
  }

  console.log(
    `Downloading ${companies.length} logo(s) → ${COMPANY_LOGOS_DIR} (concurrency=${concurrency}, force=${force})`,
  );

  const counts: Record<DownloadLogoResult, number> = { ok: 0, skipped: 0, failed: 0 };

  const supabase = createAdminClient();

  await mapWithConcurrency(companies, concurrency, START_GAP_MS, async (entry) => {
    const result = await downloadCompanyLogoFile(entry, token, { force });
    counts[result] += 1;
    const label =
      result === "ok" ? "OK" : result === "skipped" ? "SKIP" : "FAIL";
    console.log(`${label} ${entry.slug}`);

    if (result === "ok" || result === "skipped") {
      const { error: updateError } = await supabase
        .from("companies")
        .update({ logo_asset_key: entry.slug })
        .eq("slug", entry.slug);
      if (updateError) {
        console.warn(`WARN ${entry.slug}: logo_asset_key not updated (${updateError.message})`);
      }
    }

    return result;
  });

  const slugs = await writeStaticSlugManifest();
  console.log(
    `Done: ok=${counts.ok} skipped=${counts.skipped} failed=${counts.failed}; manifest=${slugs.length} slugs`,
  );

  if (counts.failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
