import { spawnSync } from "node:child_process";
import { PENDING_INTEGRATION_SEEDS } from "../lib/scraping/integration-queue-seed.ts";
import {
  blockCompany,
  claimNextBatch,
  completeCompany,
  getQueueStats,
  loadQueue,
  queueFilePath,
  releaseStaleClaims,
  saveQueue,
  syncQueueFromMigrations,
  type IntegrationQueue,
} from "../lib/scraping/integration-queue.ts";

const command = process.argv[2] ?? "help";
const rest = process.argv.slice(3);

switch (command) {
  case "status":
    printStatus(loadQueue());
    break;
  case "sync":
    runSync();
    break;
  case "init":
    runInit();
    break;
  case "claim":
    runClaim(parseClaimArgs(rest));
    break;
  case "complete":
    runComplete(rest[0], parseCompleteArgs(rest.slice(1)));
    break;
  case "block":
    runBlock(rest[0], parseReason(rest));
    break;
  case "release-stale":
    runReleaseStale();
    break;
  case "run":
    runApplyBatch(parseClaimArgs(rest));
    break;
  default:
    printUsage();
    process.exit(command === "help" ? 0 : 1);
}

function runInit() {
  const queue = loadQueueOrCreate();
  let added = 0;
  const bySlug = new Map(queue.companies.map((company) => [company.slug, company]));

  for (const seed of PENDING_INTEGRATION_SEEDS) {
    if (bySlug.has(seed.slug)) continue;
    queue.companies.push({
      ...seed,
      status: "pending",
      claimedAt: null,
      claimedBy: null,
      completedAt: null,
      lastVerifiedAt: null,
      postingsFound: null,
    });
    added += 1;
  }

  saveQueue(queue);
  console.log(`Initialized queue at ${queueFilePath()}`);
  console.log(`Added ${added} pending seed companies (${queue.companies.length} total).`);
  console.log("Run `npm run integration:queue -- sync` to mark migration-backed companies as done.");
}

function runSync() {
  const queue = loadQueueOrCreate();
  const result = syncQueueFromMigrations(queue);
  saveQueue(result.queue);
  console.log(`Synced migrations → done: ${result.markedDone.length || "(none)"}`);
  if (result.added.length > 0) {
    console.log(`Added from migrations: ${result.added.join(", ")}`);
  }
  printStatus(result.queue);
}

function runClaim(options: {
  count?: number;
  json?: boolean;
  includeCustom?: boolean;
  customOnly?: boolean;
}) {
  const queue = loadQueue();
  const count =
    options.count ??
    Number.parseInt(process.env.INTEGRATION_CLAIM_COUNT ?? String(queue.claimBatchSize), 10);
  const runId = process.env.INTEGRATION_RUN_ID ?? `run-${new Date().toISOString().slice(0, 16)}`;
  const claimed = claimNextBatch(queue, {
    count,
    runId,
    includeCustom: options.includeCustom,
    customOnly: options.customOnly,
  });
  saveQueue(queue);

  if (options.json) {
    const payload = {
      runId,
      count: claimed.length,
      dailyTarget: queue.dailyTarget,
      slugs: claimed.map((company) => company.slug),
      branches: claimed.map((company) => `integrate/company/${company.slug}`),
      companies: claimed,
    };
    console.log(JSON.stringify(payload, null, 2));
    process.exit(claimed.length > 0 ? 0 : 1);
  }

  if (claimed.length === 0) {
    console.log("No claimable companies (pending + autoApprove).");
    console.log("Tip: set autoApprove:true or pass --include-custom for Tier C.");
    printStatus(queue);
    process.exit(1);
  }

  console.log(`Claimed ${claimed.length} (run ${runId}):`);
  for (const company of claimed) {
    console.log(
      `  - ${company.slug} [${company.tier}] branch integrate/company/${company.slug}`,
    );
  }
  printStatus(queue);
}

function runComplete(slug: string | undefined, details: { postingsFound?: number; notes?: string }) {
  if (!slug) {
    console.error("Usage: npm run integration:queue -- complete <slug> [--postings N] [--notes text]");
    process.exit(1);
  }
  const queue = loadQueue();
  if (!completeCompany(queue, slug, details)) {
    console.error(`Unknown slug: ${slug}`);
    process.exit(1);
  }
  saveQueue(queue);
  console.log(`Marked ${slug} as done.`);
  printStatus(queue);
}

function runBlock(slug: string | undefined, reason: string) {
  if (!slug || !reason) {
    console.error("Usage: npm run integration:queue -- block <slug> --reason \"...\"");
    process.exit(1);
  }
  const queue = loadQueue();
  if (!blockCompany(queue, slug, reason)) {
    console.error(`Unknown slug: ${slug}`);
    process.exit(1);
  }
  saveQueue(queue);
  console.log(`Marked ${slug} as blocked.`);
  printStatus(queue);
}

function runApplyBatch(options: {
  count?: number;
  json?: boolean;
  includeCustom?: boolean;
  customOnly?: boolean;
}) {
  const queue = loadQueue();
  const count =
    options.count ??
    Number.parseInt(process.env.INTEGRATION_CLAIM_COUNT ?? String(queue.claimBatchSize), 10);
  const runId = process.env.INTEGRATION_RUN_ID ?? `run-${new Date().toISOString().slice(0, 16)}`;
  const claimed = claimNextBatch(queue, {
    count,
    runId,
    includeCustom: options.includeCustom,
    customOnly: options.customOnly,
  });
  saveQueue(queue);

  if (claimed.length === 0) {
    const message = "No claimable companies (pending + autoApprove).";
    if (options.json) {
      console.log(JSON.stringify({ runId, count: 0, slugs: [], results: [], message }, null, 2));
    } else {
      console.log(message);
      printStatus(queue);
    }
    process.exit(options.json ? 0 : 1);
  }

  const applyArgs = [
    process.execPath,
    "--experimental-strip-types",
    "scripts/apply-company-integration.ts",
    "--claimed",
  ];
  if (process.env.INTEGRATION_COMMIT_DEV === "1") {
    applyArgs.push("--commit-dev");
  }

  const apply = spawnSync(applyArgs[0], applyArgs.slice(1), {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "inherit",
    env: process.env,
  });

  if (options.json) {
    const refreshed = loadQueue();
    const results = claimed.map((company) => {
      const row = refreshed.companies.find((entry) => entry.slug === company.slug);
      return {
        slug: company.slug,
        status: row?.status ?? "unknown",
        postingsFound: row?.postingsFound ?? null,
        blockedReason: row?.blockedReason ?? null,
      };
    });
    console.log(
      JSON.stringify(
        {
          runId,
          count: claimed.length,
          slugs: claimed.map((company) => company.slug),
          applyExitCode: apply.status ?? 1,
          results,
        },
        null,
        2,
      ),
    );
  }

  process.exit(apply.status === 0 ? 0 : 1);
}

function runReleaseStale() {
  const queue = loadQueue();
  const released = releaseStaleClaims(queue);
  saveQueue(queue);
  console.log(released.length > 0 ? `Released: ${released.join(", ")}` : "No stale claims.");
  printStatus(queue);
}

function loadQueueOrCreate(): IntegrationQueue {
  try {
    return loadQueue();
  } catch {
    const queue: IntegrationQueue = {
      version: 1,
      dailyTarget: 50,
      claimBatchSize: 2,
      staleClaimHours: 4,
      companies: [],
    };
    saveQueue(queue);
    return queue;
  }
}

function printStatus(queue: IntegrationQueue) {
  const stats = getQueueStats(queue);
  console.log("");
  console.log(`Queue: ${queueFilePath()}`);
  console.log(
    `Target ${stats.dailyTarget}/day · done today ${stats.doneToday} · remaining ${stats.remainingToTarget}`,
  );
  console.log(
    `pending ${stats.pending} · in_progress ${stats.in_progress} · done ${stats.done} · blocked ${stats.blocked} · total ${stats.total}`,
  );
}

function printUsage() {
  console.log("Usage: npm run integration:queue -- <command>");
  console.log("");
  console.log("Commands:");
  console.log("  init              Add seed backlog (idempotent)");
  console.log("  sync              Mark migration-backed companies done");
  console.log("  status            Print queue stats");
  console.log("  claim [--count N] [--json] [--include-custom] [--custom-only]");
  console.log("  complete <slug> [--postings N] [--notes text]");
  console.log("  block <slug> --reason \"...\"");
  console.log("  release-stale     Reset stale in_progress rows");
  console.log("  run [--count N]   Claim then apply to Supabase (no PR); use INTEGRATION_COMMIT_DEV=1 to push dev");
  console.log("");
  console.log("Env:");
  console.log("  INTEGRATION_CLAIM_COUNT=3   Override batch size (default from queue file)");
  console.log("  INTEGRATION_RUN_ID=...      Claim owner id for automations");
}

function parseClaimArgs(args: string[]) {
  let count: number | undefined;
  let json = false;
  let includeCustom = false;
  let customOnly = false;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--count" && args[i + 1]) {
      count = Number.parseInt(args[i + 1], 10);
      i += 1;
    } else if (args[i] === "--json") {
      json = true;
    } else if (args[i] === "--include-custom") {
      includeCustom = true;
    } else if (args[i] === "--custom-only") {
      customOnly = true;
    }
  }
  return { count, json, includeCustom, customOnly };
}

function parseCompleteArgs(args: string[]) {
  const details: { postingsFound?: number; notes?: string } = {};
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--postings" && args[i + 1]) {
      details.postingsFound = Number.parseInt(args[i + 1], 10);
      i += 1;
    } else if (args[i] === "--notes" && args[i + 1]) {
      details.notes = args[i + 1];
      i += 1;
    }
  }
  return details;
}

function parseReason(args: string[]): string {
  const index = args.indexOf("--reason");
  if (index === -1 || !args[index + 1]) return "";
  return args.slice(index + 1).join(" ").replace(/^["']|["']$/g, "");
}
