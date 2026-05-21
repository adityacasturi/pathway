import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ScrapeSourceConfig } from "./types.ts";
import { CUSTOM_ADAPTER_REGISTRY } from "./registry.ts";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

export interface CompanySourceSeed {
  companySlug: string;
  companyName: string;
  sourceType: string;
  adapterKey: string;
  sourceUrl: string;
  boardToken: string | null;
  migrationFile: string;
}

export function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

export function findCompanySourceConfigs(slug: string): CompanySourceSeed[] {
  const normalized = slug.trim().toLowerCase();
  const matches: CompanySourceSeed[] = [];

  for (const file of listMigrationFiles()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    if (!sql.includes(`slug = '${normalized}'`) && !sql.includes(`'${normalized}'`)) {
      continue;
    }

    for (const config of parseCompanySourceInserts(sql, file)) {
      if (config.companySlug === normalized) {
        matches.push(config);
      }
    }
  }

  return matches;
}

export function toScrapeSourceConfig(seed: CompanySourceSeed): ScrapeSourceConfig {
  return {
    companySlug: seed.companySlug,
    companyName: seed.companyName,
    sourceType: seed.sourceType as ScrapeSourceConfig["sourceType"],
    adapterKey: seed.adapterKey,
    sourceUrl: seed.sourceUrl,
    boardToken: seed.boardToken ?? undefined,
  };
}

export function hasCustomAdapterModule(slug: string, adapterKey: string): boolean {
  if (CUSTOM_ADAPTER_REGISTRY.has(adapterKey)) return true;
  const candidates = [
    join(process.cwd(), "lib", "scraping", "adapters", `${slug}.ts`),
    join(process.cwd(), "lib", "scraping", "adapters", `${adapterKey}.ts`),
  ];
  return candidates.some((path) => {
    try {
      readFileSync(path);
      return true;
    } catch {
      return false;
    }
  });
}

function parseCompanySourceInserts(sql: string, migrationFile: string): CompanySourceSeed[] {
  const configs: CompanySourceSeed[] = [];
  const insertBlocks = sql.match(
    /insert\s+into\s+public\.company_sources[\s\S]*?(?=;\s*(?:on conflict|create |alter |grant |revoke |comment |$))/gi,
  );

  for (const block of insertBlocks ?? []) {
    const tuplePattern =
      /\(\s*\(\s*select\s+id\s+from\s+public\.companies\s+where\s+slug\s*=\s*'([^']+)'\s*\)\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']*)'\s*,\s*(?:'([^']*)'|null)\s*,/gi;
    let match: RegExpExecArray | null;
    while ((match = tuplePattern.exec(block)) !== null) {
      const [, companySlug, sourceType, adapterKey, sourceUrl, boardToken] = match;
      configs.push({
        companySlug: companySlug.trim().toLowerCase(),
        companyName: titleCaseSlug(companySlug),
        sourceType,
        adapterKey,
        sourceUrl,
        boardToken: boardToken ?? null,
        migrationFile,
      });
    }
  }

  return configs;
}

function titleCaseSlug(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
