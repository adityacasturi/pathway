import { spawnSync } from "node:child_process";
import { discoverAtsFromCareersPage } from "../lib/scraping/discover-ats.ts";
import { discoverCareersUrl } from "../lib/scraping/discover-careers.ts";
import {
  applyDiscoveryToCompany,
  clearCareersUrlHints,
  resetPendingAtsGuesses,
} from "../lib/scraping/integration-discover.ts";
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

async function main() {
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
    case "reset-guesses":
      runResetGuesses();
      break;
    case "clear-careers-hints":
      runClearCareersHints();
      break;
    case "discover-careers":
      await runDiscoverCareersOne(rest[0]);
      break;
    case "discover":
      await runDiscoverOne(rest[0]);
      break;
    default:
      printUsage();
      process.exit(command === "help" ? 0 : 1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

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

function runResetGuesses() {
  const queue = loadQueue();
  const slugs = resetPendingAtsGuesses(queue);
  saveQueue(queue);
  if (slugs.length === 0) {
    console.log("No pending/blocked autoApprove rows with guessed ATS tokens.");
  } else {
    console.log(`Reset ${slugs.length} companies to tier=discover (no boardToken):`);
    for (const slug of slugs) {
      console.log(`  - ${slug}`);
    }
  }
  printStatus(queue);
}

function runClearCareersHints() {
  const queue = loadQueue();
  const slugs = clearCareersUrlHints(queue);
  saveQueue(queue);
  if (slugs.length === 0) {
    console.log("No pending/blocked rows with careersUrl hints to clear.");
  } else {
    console.log(`Cleared careersUrl on ${slugs.length} rows (name-only discovery):`);
    for (const slug of slugs) {
      console.log(`  - ${slug}`);
    }
  }
  printStatus(queue);
}

async function runDiscoverCareersOne(slug: string | undefined) {
  if (!slug) {
    console.error("Usage: npm run integration:queue -- discover-careers <slug>");
    process.exit(1);
  }
  const normalized = slug.trim().toLowerCase();
  const queue = loadQueue();
  const company = queue.companies.find((entry) => entry.slug === normalized);
  if (!company) {
    console.error(`Unknown slug: ${slug}`);
    process.exit(1);
  }

  const savedHint = company.careersUrl;
  company.careersUrl = undefined;

  const result = await discoverCareersUrl({
    slug: company.slug,
    name: company.name,
    domain: company.domain,
  });

  if (!result.ok) {
    company.careersUrl = savedHint;
    console.error(result.reason);
    process.exit(1);
  }

  company.careersUrl = result.careersUrl;
  saveQueue(queue);
  console.log(JSON.stringify({ slug: company.slug, careersUrl: result.careersUrl, evidence: result.evidence }, null, 2));
}

async function runDiscoverOne(slug: string | undefined) {
  if (!slug) {
    console.error("Usage: npm run integration:queue -- discover <slug>");
    process.exit(1);
  }
  const normalized = slug.trim().toLowerCase();
  const queue = loadQueue();
  const company = queue.companies.find((entry) => entry.slug === normalized);
  if (!company) {
    console.error(`Unknown slug: ${slug}`);
    process.exit(1);
  }

  const careers = await discoverCareersUrl({
    slug: company.slug,
    name: company.name,
    careersUrl: company.careersUrl,
    domain: company.domain,
  });
  if (!careers.ok) {
    console.error(careers.reason);
    process.exit(1);
  }
  if (!company.careersUrl?.trim()) {
    company.careersUrl = careers.careersUrl;
    saveQueue(queue);
  }

  const result = await discoverAtsFromCareersPage(careers.careersUrl, company.slug);
  if (!result.ok) {
    console.error(result.reason);
    process.exit(1);
  }

  applyDiscoveryToCompany(company, result.discovery);
  saveQueue(queue);
  console.log(
    JSON.stringify(
      {
        slug: company.slug,
        tier: result.discovery.tier,
        boardToken: result.discovery.boardToken,
        sourceUrl: result.discovery.sourceUrl,
        adapterKey: result.discovery.adapterKey,
        evidence: result.discovery.evidence,
      },
      null,
      2,
    ),
  );
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
  console.log("  run [--count N]   Claim, discover careers + ATS, apply to Supabase");
  console.log("  discover-careers <slug>  Resolve careers page from company name");
  console.log("  discover <slug>   Discover careers (if needed) + ATS (no Supabase apply)");
  console.log("  reset-guesses     Clear guessed boardToken on pending autoApprove rows");
  console.log("  clear-careers-hints  Remove careersUrl hints (test name-only discovery)");
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
