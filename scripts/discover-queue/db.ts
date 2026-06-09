import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ClaimResult, QueueItem, QueueItemInput, QueueStatus } from "./types.ts";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
export const DEFAULT_DB_PATH = join(REPO_ROOT, "discover-queue", "queue.sqlite");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS discover_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  website_url TEXT,
  careers_url TEXT,
  industry TEXT,
  hints TEXT,
  notes TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'claimed', 'done', 'failed', 'skipped')),
  claimed_by TEXT,
  claimed_at TEXT,
  heartbeat_at TEXT,
  completed_at TEXT,
  result TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_discover_queue_claim
  ON discover_queue (status, priority DESC, created_at ASC);
`;

function rowToItem(row: Record<string, unknown>): QueueItem {
  let hints: QueueItem["hints"] = undefined;
  if (typeof row.hints === "string" && row.hints.length > 0) {
    hints = JSON.parse(row.hints) as QueueItem["hints"];
  }
  let result: QueueItem["result"] = null;
  if (typeof row.result === "string" && row.result.length > 0) {
    result = JSON.parse(row.result) as Record<string, unknown>;
  }
  return {
    id: row.id as number,
    slug: row.slug as string,
    name: row.name as string,
    websiteUrl: (row.website_url as string | null) ?? null,
    careersUrl: (row.careers_url as string | null) ?? null,
    industry: (row.industry as string | null) ?? null,
    hints,
    notes: (row.notes as string | null) ?? null,
    priority: row.priority as number,
    status: row.status as QueueStatus,
    claimedBy: (row.claimed_by as string | null) ?? null,
    claimedAt: (row.claimed_at as string | null) ?? null,
    heartbeatAt: (row.heartbeat_at as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
    result,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export class DiscoverQueueDb {
  readonly db: DatabaseSync;

  constructor(dbPath = DEFAULT_DB_PATH) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA busy_timeout = 5000;");
    this.db.exec(SCHEMA);
  }

  close() {
    this.db.close();
  }

  add(input: QueueItemInput): QueueItem {
    const hints = input.hints?.length ? JSON.stringify(input.hints) : null;
    const insert = this.db.prepare(`
      INSERT INTO discover_queue (
        slug, name, website_url, careers_url, industry, hints, notes, priority
      ) VALUES (
        @slug, @name, @websiteUrl, @careersUrl, @industry, @hints, @notes, @priority
      )
      ON CONFLICT(slug) DO UPDATE SET
        name = excluded.name,
        website_url = COALESCE(excluded.website_url, discover_queue.website_url),
        careers_url = COALESCE(excluded.careers_url, discover_queue.careers_url),
        industry = COALESCE(excluded.industry, discover_queue.industry),
        hints = COALESCE(excluded.hints, discover_queue.hints),
        notes = COALESCE(excluded.notes, discover_queue.notes),
        priority = MAX(excluded.priority, discover_queue.priority),
        updated_at = datetime('now'),
        status = CASE
          WHEN discover_queue.status IN ('done', 'skipped') THEN discover_queue.status
          ELSE 'pending'
        END,
        claimed_by = CASE
          WHEN discover_queue.status IN ('done', 'skipped') THEN discover_queue.claimed_by
          ELSE NULL
        END,
        claimed_at = CASE
          WHEN discover_queue.status IN ('done', 'skipped') THEN discover_queue.claimed_at
          ELSE NULL
        END,
        heartbeat_at = CASE
          WHEN discover_queue.status IN ('done', 'skipped') THEN discover_queue.heartbeat_at
          ELSE NULL
        END,
        completed_at = CASE
          WHEN discover_queue.status IN ('done', 'skipped') THEN discover_queue.completed_at
          ELSE NULL
        END,
        result = CASE
          WHEN discover_queue.status IN ('done', 'skipped') THEN discover_queue.result
          ELSE NULL
        END
      RETURNING *
    `);
    const row = insert.get({
      slug: input.slug,
      name: input.name,
      websiteUrl: input.websiteUrl ?? null,
      careersUrl: input.careersUrl ?? null,
      industry: input.industry ?? null,
      hints,
      notes: input.notes ?? null,
      priority: input.priority ?? 0,
    }) as Record<string, unknown>;
    return rowToItem(row);
  }

  /**
   * Atomically claim the next pending row (BEGIN IMMEDIATE transaction).
   */
  claim(workerId: string): ClaimResult {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare(`
        UPDATE discover_queue
        SET
          status = 'pending',
          claimed_by = NULL,
          claimed_at = NULL,
          heartbeat_at = NULL,
          updated_at = datetime('now')
        WHERE status = 'claimed'
          AND heartbeat_at IS NOT NULL
          AND heartbeat_at < datetime('now', '-120 minutes')
      `).run();

      const next = this.db.prepare(`
        SELECT id FROM discover_queue
        WHERE status = 'pending'
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
      `).get() as { id: number } | undefined;

      if (!next) {
        this.db.exec("COMMIT");
        return { workerId, claimed: null };
      }

      const updated = this.db.prepare(`
        UPDATE discover_queue
        SET
          status = 'claimed',
          claimed_by = @workerId,
          claimed_at = datetime('now'),
          heartbeat_at = datetime('now'),
          updated_at = datetime('now')
        WHERE id = @id AND status = 'pending'
        RETURNING *
      `).get({ id: next.id, workerId }) as Record<string, unknown> | undefined;

      this.db.exec("COMMIT");
      return { workerId, claimed: updated ? rowToItem(updated) : null };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  heartbeat(id: number, workerId: string): boolean {
    const result = this.db.prepare(`
      UPDATE discover_queue
      SET heartbeat_at = datetime('now'), updated_at = datetime('now')
      WHERE id = @id AND status = 'claimed' AND claimed_by = @workerId
    `).run({ id, workerId });
    return result.changes > 0;
  }

  release(id: number, workerId: string): boolean {
    const result = this.db.prepare(`
      UPDATE discover_queue
      SET
        status = 'pending',
        claimed_by = NULL,
        claimed_at = NULL,
        heartbeat_at = NULL,
        updated_at = datetime('now')
      WHERE id = @id AND status = 'claimed' AND claimed_by = @workerId
    `).run({ id, workerId });
    return result.changes > 0;
  }

  complete(id: number, workerId: string, result: Record<string, unknown>): QueueItem | null {
    const row = this.db.prepare(`
      UPDATE discover_queue
      SET
        status = 'done',
        result = @result,
        completed_at = datetime('now'),
        updated_at = datetime('now')
      WHERE id = @id AND status = 'claimed' AND claimed_by = @workerId
      RETURNING *
    `).get({
      id,
      workerId,
      result: JSON.stringify(result),
    }) as Record<string, unknown> | undefined;
    return row ? rowToItem(row) : null;
  }

  fail(id: number, workerId: string, result: Record<string, unknown>): QueueItem | null {
    const row = this.db.prepare(`
      UPDATE discover_queue
      SET
        status = 'failed',
        result = @result,
        completed_at = datetime('now'),
        updated_at = datetime('now')
      WHERE id = @id AND status = 'claimed' AND claimed_by = @workerId
      RETURNING *
    `).get({
      id,
      workerId,
      result: JSON.stringify(result),
    }) as Record<string, unknown> | undefined;
    return row ? rowToItem(row) : null;
  }

  skip(id: number, reason: string): QueueItem | null {
    const row = this.db.prepare(`
      UPDATE discover_queue
      SET
        status = 'skipped',
        result = @result,
        completed_at = datetime('now'),
        updated_at = datetime('now')
      WHERE id = @id AND status IN ('pending', 'claimed', 'failed')
      RETURNING *
    `).get({
      id,
      result: JSON.stringify({ reason }),
    }) as Record<string, unknown> | undefined;
    return row ? rowToItem(row) : null;
  }

  list(status?: QueueStatus): QueueItem[] {
    if (status) {
      const rows = this.db.prepare(`
        SELECT * FROM discover_queue
        WHERE status = @status
        ORDER BY priority DESC, created_at ASC
      `).all({ status }) as Record<string, unknown>[];
      return rows.map(rowToItem);
    }
    const rows = this.db.prepare(`
      SELECT * FROM discover_queue
      ORDER BY
        CASE status
          WHEN 'claimed' THEN 0
          WHEN 'pending' THEN 1
          WHEN 'failed' THEN 2
          WHEN 'done' THEN 3
          ELSE 4
        END,
        priority DESC,
        created_at ASC
    `).all() as Record<string, unknown>[];
    return rows.map(rowToItem);
  }

  getBySlug(slug: string): QueueItem | null {
    const row = this.db.prepare(`SELECT * FROM discover_queue WHERE slug = @slug`).get({
      slug,
    }) as Record<string, unknown> | undefined;
    return row ? rowToItem(row) : null;
  }
}

export function defaultWorkerId(): string {
  const fromEnv = process.env.DISCOVER_QUEUE_WORKER?.trim();
  if (fromEnv) return fromEnv;
  const host = process.env.HOSTNAME ?? process.env.COMPUTERNAME ?? "local";
  return `${host}-${process.pid}`;
}
