import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkDiscoverCatalog } from "./catalog.ts";
import { DiscoverQueueDb, defaultWorkerId } from "./db.ts";
import type { QueueItemInput, SourceHint } from "./types.ts";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

function usage(): never {
  console.error(`Usage: npm run discover-queue -- <command> [options]

Commands:
  add --slug <slug> --name <name> [--website <url>] [--careers <url>] [--industry <id>]
        [--hints greenhouse,ashby] [--notes <text>] [--priority <n>]
  import <file.json>          Import array of companies (merges by slug)
  claim [--worker <id>]       Atomically claim next pending item (JSON to stdout)
  heartbeat --id <n>          Extend lease for a claimed item
  complete --id <n> [--worker <id>] --result '<json>'
  fail --id <n> [--worker <id>] --result '<json>'
  release --id <n>              Return claimed item to pending (same worker only)
  skip --slug <slug> --reason <text>
  list [--status pending|claimed|done|failed|skipped]
  stats
  catalog-check --slug <slug>   Query Supabase for company + enabled source (JSON)

Environment:
  DISCOVER_QUEUE_WORKER   Stable worker id for claim/complete (e.g. cursor-agent-1)
`);
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        flags[key] = "true";
      } else {
        flags[key] = next;
        i++;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function parseHints(raw: string | undefined): SourceHint[] | undefined {
  if (!raw) return undefined;
  return raw.split(",").map((h) => h.trim()) as SourceHint[];
}

function readImportFile(path: string): QueueItemInput[] {
  const abs = path.startsWith("/") ? path : join(process.cwd(), path);
  const data = JSON.parse(readFileSync(abs, "utf8")) as unknown;
  if (!Array.isArray(data)) {
    throw new Error("Import file must be a JSON array");
  }
  return data.map((row, index) => {
    const item = row as Record<string, unknown>;
    const slug = String(item.slug ?? "").trim();
    const name = String(item.name ?? "").trim();
    if (!slug || !name) {
      throw new Error(`Import row ${index} missing slug or name`);
    }
    return {
      slug,
      name,
      websiteUrl: item.websiteUrl != null ? String(item.websiteUrl) : (item.website_url != null ? String(item.website_url) : null),
      careersUrl: item.careersUrl != null ? String(item.careersUrl) : (item.careers_url != null ? String(item.careers_url) : null),
      industry: item.industry != null ? String(item.industry) : null,
      hints: Array.isArray(item.hints) ? (item.hints as SourceHint[]) : parseHints(item.hints as string | undefined),
      notes: item.notes != null ? String(item.notes) : null,
      priority: typeof item.priority === "number" ? item.priority : Number(item.priority ?? 0) || 0,
    } satisfies QueueItemInput;
  });
}

async function runCatalogCheck(slug: string) {
  try {
    const result = await checkDiscoverCatalog(slug);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.inCatalog ? 0 : 2);
  } catch (error) {
    console.error(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    process.exit(1);
  }
}

function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const command = positional[0];
  if (!command) usage();

  if (command === "catalog-check") {
    const slug = flags.slug?.trim();
    if (!slug) usage();
    void runCatalogCheck(slug);
    return;
  }

  const db = new DiscoverQueueDb();
  try {
    switch (command) {
      case "add": {
        const slug = flags.slug;
        const name = flags.name;
        if (!slug || !name) usage();
        const item = db.add({
          slug,
          name,
          websiteUrl: flags.website ?? null,
          careersUrl: flags.careers ?? null,
          industry: flags.industry ?? null,
          hints: parseHints(flags.hints),
          notes: flags.notes ?? null,
          priority: flags.priority ? Number(flags.priority) : 0,
        });
        console.log(JSON.stringify({ ok: true, item }, null, 2));
        break;
      }
      case "import": {
        const file = positional[1] ?? join(REPO_ROOT, "discover-queue", "inbox.json");
        const rows = readImportFile(file);
        const items = rows.map((row) => db.add(row));
        console.log(JSON.stringify({ ok: true, imported: items.length, items }, null, 2));
        break;
      }
      case "claim": {
        const workerId = flags.worker ?? defaultWorkerId();
        const result = db.claim(workerId);
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.claimed ? 0 : 2);
      }
      case "heartbeat": {
        const id = Number(flags.id);
        const workerId = flags.worker ?? defaultWorkerId();
        if (!Number.isFinite(id)) usage();
        const ok = db.heartbeat(id, workerId);
        console.log(JSON.stringify({ ok, id, workerId }));
        process.exit(ok ? 0 : 1);
      }
      case "complete": {
        const id = Number(flags.id);
        const workerId = flags.worker ?? defaultWorkerId();
        const resultRaw = flags.result ?? "{}";
        if (!Number.isFinite(id)) usage();
        const result = JSON.parse(resultRaw) as Record<string, unknown>;
        const item = db.complete(id, workerId, result);
        console.log(JSON.stringify({ ok: Boolean(item), item }, null, 2));
        process.exit(item ? 0 : 1);
      }
      case "fail": {
        const id = Number(flags.id);
        const workerId = flags.worker ?? defaultWorkerId();
        const resultRaw = flags.result ?? "{}";
        if (!Number.isFinite(id)) usage();
        const result = JSON.parse(resultRaw) as Record<string, unknown>;
        const item = db.fail(id, workerId, result);
        console.log(JSON.stringify({ ok: Boolean(item), item }, null, 2));
        process.exit(item ? 0 : 1);
      }
      case "release": {
        const id = Number(flags.id);
        const workerId = flags.worker ?? defaultWorkerId();
        if (!Number.isFinite(id)) usage();
        const ok = db.release(id, workerId);
        console.log(JSON.stringify({ ok, id, workerId }));
        process.exit(ok ? 0 : 1);
      }
      case "skip": {
        const slug = flags.slug;
        const reason = flags.reason ?? "skipped manually";
        if (!slug) usage();
        const existing = db.getBySlug(slug);
        if (!existing) {
          console.error(JSON.stringify({ ok: false, error: "not found", slug }));
          process.exit(1);
        }
        const item = db.skip(existing.id, reason);
        console.log(JSON.stringify({ ok: Boolean(item), item }, null, 2));
        break;
      }
      case "list": {
        const status = flags.status as import("./types.ts").QueueStatus | undefined;
        const items = db.list(status);
        console.log(JSON.stringify({ count: items.length, items }, null, 2));
        break;
      }
      case "stats": {
        const items = db.list();
        const byStatus = Object.groupBy(items, (item) => item.status);
        console.log(
          JSON.stringify(
            {
              total: items.length,
              pending: byStatus.pending?.length ?? 0,
              claimed: byStatus.claimed?.length ?? 0,
              done: byStatus.done?.length ?? 0,
              failed: byStatus.failed?.length ?? 0,
              skipped: byStatus.skipped?.length ?? 0,
            },
            null,
            2,
          ),
        );
        break;
      }
      default:
        usage();
    }
  } finally {
    db.close();
  }
}

main();
