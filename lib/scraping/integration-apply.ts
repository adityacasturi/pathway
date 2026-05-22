import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createAdminClient } from "../supabase/admin.ts";
import { completeCompany, loadQueue, saveQueue } from "./integration-queue.ts";
import { canAutoApplyFromQueue, queueCompanyToSourceConfig } from "./queue-source.ts";
import { buildScrapeAdapter } from "./registry.ts";
import { runScrapeAdapter } from "./upsert.ts";
import type { ScrapeSourceConfig } from "./types.ts";

export interface ApplyReport {
  slug: string;
  ok: boolean;
  postingsFound: number;
  steps: Array<{ name: string; ok: boolean; detail: string }>;
}

export async function applyCompanyFromQueue(
  slug: string,
  options: { writeMigration?: boolean; minFound?: number } = {},
): Promise<ApplyReport> {
  const normalized = slug.trim().toLowerCase();
  const minFound = options.minFound ?? Number.parseInt(process.env.VERIFY_MIN_FOUND ?? "1", 10);
  const steps: ApplyReport["steps"] = [];
  const queue = loadQueue();
  const company = queue.companies.find((entry) => entry.slug === normalized);

  if (!company) {
    return {
      slug: normalized,
      ok: false,
      postingsFound: 0,
      steps: [{ name: "queue_lookup", ok: false, detail: `Unknown slug "${normalized}"` }],
    };
  }

  if (!canAutoApplyFromQueue(company)) {
    return {
      slug: normalized,
      ok: false,
      postingsFound: 0,
      steps: [{
        name: "auto_apply_eligible",
        ok: false,
        detail: `tier=${company.tier} requires manual integration (PR with adapter/migration).`,
      }],
    };
  }

  let source: ScrapeSourceConfig;
  try {
    source = queueCompanyToSourceConfig(company);
    steps.push({
      name: "queue_source",
      ok: true,
      detail: `${source.sourceType} ${source.adapterKey} (${source.sourceUrl})`,
    });
  } catch (error) {
    return {
      slug: normalized,
      ok: false,
      postingsFound: 0,
      steps: [{
        name: "queue_source",
        ok: false,
        detail: formatError(error),
      }],
    };
  }

  const unitTest = runUnitTests();
  steps.push(unitTest);
  if (!unitTest.ok) {
    return { slug: normalized, ok: false, postingsFound: 0, steps };
  }

  const adapter = buildScrapeAdapter(source);
  if (!adapter) {
    steps.push({
      name: "adapter_build",
      ok: false,
      detail: `Unable to build adapter for ${source.adapterKey}`,
    });
    return { slug: normalized, ok: false, postingsFound: 0, steps };
  }
  steps.push({
    name: "adapter_build",
    ok: true,
    detail: `Built ${source.sourceType} adapter (${source.adapterKey})`,
  });

  let postingsFound = 0;
  try {
    const postings = await adapter.fetchPostings();
    postingsFound = postings.length;
    const liveOk = postings.length >= minFound;
    steps.push({
      name: "live_fetch",
      ok: liveOk,
      detail: liveOk
        ? `Fetched ${postings.length} normalized posting(s)`
        : `Expected at least ${minFound}; got ${postings.length}`,
    });
    if (!liveOk) {
      return { slug: normalized, ok: false, postingsFound, steps };
    }
  } catch (error) {
    steps.push({ name: "live_fetch", ok: false, detail: formatError(error) });
    return { slug: normalized, ok: false, postingsFound: 0, steps };
  }

  try {
    const supabase = createAdminClient();
    const summary = await runScrapeAdapter(supabase, adapter);
    postingsFound = summary.found;
    const scrapeOk = summary.found >= minFound;
    steps.push({
      name: "supabase_apply",
      ok: scrapeOk,
      detail: `found=${summary.found} inserted=${summary.inserted} updated=${summary.updated}`,
    });
    if (!scrapeOk) {
      return { slug: normalized, ok: false, postingsFound, steps };
    }
  } catch (error) {
    steps.push({ name: "supabase_apply", ok: false, detail: formatError(error) });
    return { slug: normalized, ok: false, postingsFound: 0, steps };
  }

  if (options.writeMigration !== false) {
    try {
      const path = writeStandardSourceMigration(source, company.priority);
      steps.push({
        name: "migration_file",
        ok: true,
        detail: `Wrote ${path} (apply via Supabase migration flow when convenient)`,
      });
    } catch (error) {
      steps.push({
        name: "migration_file",
        ok: false,
        detail: formatError(error),
      });
    }
  }

  completeCompany(queue, normalized, {
    postingsFound,
    notes: "Applied via integration:apply (Supabase upsert, no PR)",
  });
  saveQueue(queue);
  steps.push({
    name: "queue_complete",
    ok: true,
    detail: `Marked ${normalized} done (postingsFound=${postingsFound})`,
  });

  return { slug: normalized, ok: true, postingsFound, steps };
}

export function writeStandardSourceMigration(
  source: ScrapeSourceConfig,
  priority = 50,
): string {
  const migrationsDir = join(process.cwd(), "supabase", "migrations");
  const prefix = `${nextMigrationPrefix(migrationsDir)}_add_${source.companySlug}_${source.sourceType}_source.sql`;
  const path = join(migrationsDir, prefix);
  const websiteUrl = source.sourceUrl.replace(/\/$/, "");
  const sql = `-- Auto-generated by integration:apply for ${source.companyName}

insert into public.companies (slug, name, website_url, careers_url, priority)
values
  (
    '${source.companySlug}',
    '${escapeSql(source.companyName)}',
    '${escapeSql(websiteUrl)}',
    '${escapeSql(websiteUrl)}',
    ${priority}
  )
on conflict (slug) do update set
  name = excluded.name,
  website_url = excluded.website_url,
  careers_url = excluded.careers_url,
  priority = excluded.priority,
  is_active = true,
  updated_at = now();

insert into public.company_sources (
  company_id,
  source_type,
  adapter_key,
  source_url,
  board_token,
  enabled,
  scrape_interval_minutes
)
values
  (
    (select id from public.companies where slug = '${source.companySlug}'),
    '${source.sourceType}',
    '${source.adapterKey}',
    '${escapeSql(source.sourceUrl)}',
    '${escapeSql(source.boardToken ?? "")}',
    true,
    180
  );
`;

  writeFileSync(path, sql, "utf8");
  return path;
}

function nextMigrationPrefix(migrationsDir: string): string {
  mkdirSync(migrationsDir, { recursive: true });
  const numbers = readdirSync(migrationsDir)
    .map((name) => /^(\d+)_/.exec(name)?.[1])
    .filter(Boolean)
    .map((value) => Number.parseInt(value!, 10));
  const next = (numbers.length > 0 ? Math.max(...numbers) : 0) + 1;
  return String(next).padStart(3, "0");
}

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

function runUnitTests(): ApplyReport["steps"][number] {
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
      env: { ...process.env, NODE_OPTIONS: "" },
    },
  );

  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const ok = result.status === 0;
  return {
    name: "unit_tests",
    ok,
    detail: ok
      ? "Unit tests passed"
      : combined.split("\n").slice(-12).join("\n").trim() || `Unit tests failed (${result.status})`,
  };
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
