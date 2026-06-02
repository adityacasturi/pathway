import { buildScrapeAdapter } from "./registry.ts";
import {
  mapWithConcurrency,
  readCompanyConcurrency,
  resolveScrapeHostKey,
  ScrapeConcurrencyPool,
} from "./scrape-concurrency.ts";
import { mapCompanySourceRow, runScrapeAdapter, type CompanySourceRow } from "./upsert.ts";
import type { ScrapeProgressHandler, SourceScrapeResult } from "./types.ts";
import { createAdminClient } from "../supabase/admin.ts";

export interface RunAllScrapesOptions {
  filterSlug?: string;
  dryRun?: boolean;
  onProgress?: ScrapeProgressHandler;
  /** Override `SCRAPE_COMPANY_CONCURRENCY` for this run. */
  companyConcurrency?: number;
  /** Deterministically run only a subset of sources for distributed cron jobs. */
  sourceShard?: ScrapeSourceShard;
}

export interface ScrapeSourceShard {
  index: number;
  count: number;
}

interface ScrapeJob {
  index: number;
  config: NonNullable<ReturnType<typeof mapCompanySourceRow>>;
  adapter: ReturnType<typeof buildScrapeAdapter>;
}

export async function runAllScrapes(
  filterSlugOrOptions?: string | RunAllScrapesOptions,
  onProgress?: ScrapeProgressHandler,
): Promise<SourceScrapeResult[]> {
  const options = normalizeRunOptions(filterSlugOrOptions, onProgress);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("company_sources")
    .select(
      `
      id,
      source_type,
      adapter_key,
      source_url,
      board_token,
      companies (
        id,
        slug,
        name
      )
    `,
    )
    .eq("enabled", true);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as unknown as CompanySourceRow[];
  rows.sort((a, b) =>
    (a.companies?.name ?? "").localeCompare(b.companies?.name ?? "", undefined, {
      sensitivity: "base",
    }),
  );

  const jobs: ScrapeJob[] = [];

  for (const row of rows) {
    const config = mapCompanySourceRow(row);
    if (!config) {
      continue;
    }
    if (options.filterSlug && config.companySlug !== options.filterSlug) {
      continue;
    }
    if (options.sourceShard && !sourceBelongsToShard(config, options.sourceShard)) {
      continue;
    }

    jobs.push({
      index: jobs.length,
      config,
      adapter: buildScrapeAdapter(config),
    });
  }

  const companyConcurrency = options.companyConcurrency ?? readCompanyConcurrency();
  const pool = new ScrapeConcurrencyPool(companyConcurrency);
  const emitProgress = createProgressEmitter(options.onProgress);

  await emitProgress({
    type: "start",
    total: jobs.length,
    filterSlug: options.filterSlug,
    dryRun: options.dryRun,
  });

  if (jobs.length === 0) {
    return [];
  }

  return mapWithConcurrency(jobs, companyConcurrency, async (job) => {
    const step = job.index + 1;
    const { config } = job;

    if (!job.adapter) {
      const result: SourceScrapeResult = {
        slug: config.companySlug,
        status: "error",
        openCount: 0,
        error: `No adapter for ${config.sourceType}`,
      };
      await emitProgress({
        type: "begin",
        index: step,
        total: jobs.length,
        slug: config.companySlug,
        companyName: config.companyName,
        sourceType: config.sourceType,
      });
      await emitProgress({ type: "done", index: step, total: jobs.length, result, durationMs: 0 });
      return result;
    }

    await emitProgress({
      type: "begin",
      index: step,
      total: jobs.length,
      slug: config.companySlug,
      companyName: config.companyName,
      sourceType: config.sourceType,
    });

    const hostKey = resolveScrapeHostKey(config);
    const startedAt = Date.now();

    const result = await pool.run(hostKey, () =>
      runScrapeAdapter(supabase, job.adapter!, { dryRun: options.dryRun }),
    );

    await emitProgress({
      type: "done",
      index: step,
      total: jobs.length,
      result,
      durationMs: Date.now() - startedAt,
    });

    return result;
  });
}

export function sourceBelongsToShard(
  config: NonNullable<ReturnType<typeof mapCompanySourceRow>>,
  shard: ScrapeSourceShard,
): boolean {
  return stableShardForKey(buildScrapeSourceShardKey(config), shard.count) === shard.index;
}

export function buildScrapeSourceShardKey(
  config: NonNullable<ReturnType<typeof mapCompanySourceRow>>,
): string {
  return [
    config.companySlug,
    config.sourceType,
    config.adapterKey,
    config.sourceUrl,
    config.boardToken ?? "",
  ].join("\u001f");
}

export function stableShardForKey(key: string, shardCount: number): number {
  if (!Number.isSafeInteger(shardCount) || shardCount < 1) {
    throw new Error("shardCount must be a positive integer");
  }

  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % shardCount;
}

function createProgressEmitter(onProgress?: ScrapeProgressHandler) {
  let chain = Promise.resolve();

  return (event: Parameters<NonNullable<ScrapeProgressHandler>>[0]): Promise<void> => {
    if (!onProgress) {
      return Promise.resolve();
    }
    chain = chain.then(() => {
      onProgress(event);
    });
    return chain;
  };
}

function normalizeRunOptions(
  filterSlugOrOptions?: string | RunAllScrapesOptions,
  onProgress?: ScrapeProgressHandler,
): RunAllScrapesOptions {
  if (typeof filterSlugOrOptions === "string") {
    return { filterSlug: filterSlugOrOptions, onProgress };
  }
  if (filterSlugOrOptions) {
    return filterSlugOrOptions;
  }
  return { onProgress };
}
