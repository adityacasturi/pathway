import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { listMigrationFiles, type CompanySourceSeed } from "./integration-config.ts";

export type IntegrationTier = "greenhouse" | "lever" | "ashby" | "custom" | "discover";
export type IntegrationStatus = "pending" | "in_progress" | "done" | "blocked";

export interface QueueCompany {
  slug: string;
  name: string;
  careersUrl?: string;
  tier: IntegrationTier;
  status: IntegrationStatus;
  /** Lower number = claimed sooner. */
  priority: number;
  /** Tier A: agent may run without human approval. */
  autoApprove: boolean;
  sourceType?: string;
  boardToken?: string;
  adapterKey?: string;
  notes?: string;
  blockedReason?: string;
  claimedAt?: string | null;
  claimedBy?: string | null;
  completedAt?: string | null;
  lastVerifiedAt?: string | null;
  postingsFound?: number | null;
}

export interface IntegrationQueue {
  version: number;
  dailyTarget: number;
  claimBatchSize: number;
  staleClaimHours: number;
  companies: QueueCompany[];
}

const QUEUE_PATH = join(process.cwd(), "docs", "company-integration-queue.json");

const TIER_ORDER: Record<IntegrationTier, number> = {
  greenhouse: 0,
  lever: 1,
  ashby: 2,
  custom: 3,
  discover: 4,
};

export function queueFilePath(): string {
  return QUEUE_PATH;
}

export function loadQueue(): IntegrationQueue {
  const raw = readFileSync(QUEUE_PATH, "utf8");
  return JSON.parse(raw) as IntegrationQueue;
}

export function saveQueue(queue: IntegrationQueue): void {
  writeFileSync(QUEUE_PATH, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
}

export function getQueueStats(queue: IntegrationQueue) {
  const counts: Record<IntegrationStatus, number> = {
    pending: 0,
    in_progress: 0,
    done: 0,
    blocked: 0,
  };
  for (const company of queue.companies) {
    counts[company.status] += 1;
  }
  const doneToday = queue.companies.filter((company) => {
    if (company.status !== "done" || !company.completedAt) return false;
    const completed = new Date(company.completedAt);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return completed >= start;
  }).length;

  return {
    ...counts,
    total: queue.companies.length,
    doneToday,
    dailyTarget: queue.dailyTarget,
    remainingToTarget: Math.max(0, queue.dailyTarget - doneToday),
  };
}

export function listAllMigrationSources(): CompanySourceSeed[] {
  const bySlug = new Map<string, CompanySourceSeed>();
  for (const file of listMigrationFiles()) {
    const sql = readFileSync(join(process.cwd(), "supabase", "migrations", file), "utf8");
    const insertBlocks = sql.match(
      /insert\s+into\s+public\.company_sources[\s\S]*?(?=;\s*(?:on conflict|create |alter |grant |revoke |comment |$))/gi,
    );
    for (const block of insertBlocks ?? []) {
      const tuplePattern =
        /\(\s*\(\s*select\s+id\s+from\s+public\.companies\s+where\s+slug\s*=\s*'([^']+)'\s*\)\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']*)'\s*,\s*(?:'([^']*)'|null)\s*,/gi;
      let match: RegExpExecArray | null;
      while ((match = tuplePattern.exec(block)) !== null) {
        const [, companySlug, sourceType, adapterKey, sourceUrl, boardToken] = match;
        bySlug.set(companySlug.trim().toLowerCase(), {
          companySlug: companySlug.trim().toLowerCase(),
          companyName: titleCaseSlug(companySlug),
          sourceType,
          adapterKey,
          sourceUrl,
          boardToken: boardToken ?? null,
          migrationFile: file,
        });
      }
    }
  }
  return Array.from(bySlug.values());
}

export function syncQueueFromMigrations(queue: IntegrationQueue): {
  queue: IntegrationQueue;
  markedDone: string[];
  added: string[];
} {
  const sources = listAllMigrationSources();
  const markedDone: string[] = [];
  const added: string[] = [];
  const bySlug = new Map(queue.companies.map((company) => [company.slug, company]));

  for (const source of sources) {
    const tier = sourceTypeToTier(source.sourceType);
    let company = bySlug.get(source.companySlug);
    if (!company) {
      company = {
        slug: source.companySlug,
        name: source.companyName,
        careersUrl: source.sourceUrl,
        tier,
        status: "done",
        priority: 100,
        autoApprove: tier !== "custom",
        sourceType: source.sourceType,
        boardToken: source.boardToken ?? undefined,
        adapterKey: source.adapterKey,
        notes: `Synced from ${source.migrationFile}`,
        completedAt: new Date().toISOString(),
      };
      queue.companies.push(company);
      bySlug.set(company.slug, company);
      added.push(company.slug);
      continue;
    }

    company.sourceType = source.sourceType;
    company.boardToken = source.boardToken ?? undefined;
    company.adapterKey = source.adapterKey;
    company.tier = tier;
    if (company.status === "pending" || company.status === "in_progress") {
      company.status = "done";
      company.completedAt = company.completedAt ?? new Date().toISOString();
      company.notes = `Synced from ${source.migrationFile}`;
      markedDone.push(company.slug);
    }
  }

  return { queue, markedDone, added };
}

export function releaseStaleClaims(queue: IntegrationQueue): string[] {
  const released: string[] = [];
  const cutoff = Date.now() - queue.staleClaimHours * 60 * 60 * 1000;

  for (const company of queue.companies) {
    if (company.status !== "in_progress" || !company.claimedAt) continue;
    const claimedMs = Date.parse(company.claimedAt);
    if (!Number.isFinite(claimedMs) || claimedMs >= cutoff) continue;
    company.status = "pending";
    company.claimedAt = null;
    company.claimedBy = null;
    released.push(company.slug);
  }

  return released;
}

export function claimNextBatch(
  queue: IntegrationQueue,
  options: { count?: number; runId?: string; includeCustom?: boolean; customOnly?: boolean } = {},
): QueueCompany[] {
  const count = options.count ?? queue.claimBatchSize;
  const runId = options.runId ?? `run-${Date.now()}`;
  releaseStaleClaims(queue);

  const candidates = queue.companies
    .filter((company) => {
      if (company.status !== "pending") return false;
      if (options.customOnly) return !company.autoApprove;
      if (options.includeCustom) return true;
      return company.autoApprove;
    })
    .sort(compareClaimPriority)
    .slice(0, count);

  const now = new Date().toISOString();
  for (const company of candidates) {
    company.status = "in_progress";
    company.claimedAt = now;
    company.claimedBy = runId;
  }

  return candidates;
}

export function completeCompany(
  queue: IntegrationQueue,
  slug: string,
  details: { postingsFound?: number; notes?: string } = {},
): boolean {
  const company = queue.companies.find((entry) => entry.slug === slug);
  if (!company) return false;
  company.status = "done";
  company.completedAt = new Date().toISOString();
  company.lastVerifiedAt = company.completedAt;
  company.claimedAt = null;
  company.claimedBy = null;
  company.blockedReason = undefined;
  if (details.postingsFound !== undefined) company.postingsFound = details.postingsFound;
  if (details.notes) company.notes = details.notes;
  return true;
}

export function blockCompany(
  queue: IntegrationQueue,
  slug: string,
  reason: string,
): boolean {
  const company = queue.companies.find((entry) => entry.slug === slug);
  if (!company) return false;
  company.status = "blocked";
  company.blockedReason = reason;
  company.claimedAt = null;
  company.claimedBy = null;
  return true;
}

function compareClaimPriority(a: QueueCompany, b: QueueCompany): number {
  if (a.autoApprove !== b.autoApprove) return a.autoApprove ? -1 : 1;
  const tierDiff = TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
  if (tierDiff !== 0) return tierDiff;
  if (a.priority !== b.priority) return a.priority - b.priority;
  return a.slug.localeCompare(b.slug);
}

function sourceTypeToTier(sourceType: string): IntegrationTier {
  if (sourceType === "greenhouse") return "greenhouse";
  if (sourceType === "lever") return "lever";
  if (sourceType === "ashby") return "ashby";
  if (sourceType === "custom") return "custom";
  return "discover";
}

function titleCaseSlug(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
