import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DiscoverQueueDb } from "../../scripts/discover-queue/db.ts";

test("claim is atomic across workers", () => {
  const dir = mkdtempSync(join(tmpdir(), "discover-queue-"));
  const dbPath = join(dir, "queue.sqlite");
  const db = new DiscoverQueueDb(dbPath);
  try {
    db.add({ slug: "alpha", name: "Alpha", priority: 1 });
    db.add({ slug: "beta", name: "Beta", priority: 0 });

    const a = db.claim("worker-a");
    const b = db.claim("worker-b");
    assert.ok(a.claimed);
    assert.ok(b.claimed);
    assert.notEqual(a.claimed!.id, b.claimed!.id);

    const third = db.claim("worker-c");
    assert.equal(third.claimed, null);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("complete requires matching worker", () => {
  const dir = mkdtempSync(join(tmpdir(), "discover-queue-"));
  const dbPath = join(dir, "queue.sqlite");
  const db = new DiscoverQueueDb(dbPath);
  try {
    db.add({ slug: "gamma", name: "Gamma" });
    const { claimed } = db.claim("owner");
    assert.ok(claimed);
    const denied = db.complete(claimed!.id, "other", { ok: true });
    assert.equal(denied, null);
    const done = db.complete(claimed!.id, "owner", { migration: "test.sql" });
    assert.equal(done?.status, "done");
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
