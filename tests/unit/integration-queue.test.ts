import assert from "node:assert/strict";
import test from "node:test";
import {
  claimNextBatch,
  completeCompany,
  releaseStaleClaims,
  type IntegrationQueue,
} from "../../lib/scraping/integration-queue.ts";

function makeQueue(): IntegrationQueue {
  return {
    version: 1,
    dailyTarget: 50,
    claimBatchSize: 2,
    staleClaimHours: 4,
    companies: [
      {
        slug: "alpha",
        name: "Alpha",
        tier: "greenhouse",
        status: "pending",
        priority: 10,
        autoApprove: true,
      },
      {
        slug: "beta",
        name: "Beta",
        tier: "greenhouse",
        status: "pending",
        priority: 20,
        autoApprove: true,
      },
      {
        slug: "gamma",
        name: "Gamma",
        tier: "custom",
        status: "pending",
        priority: 5,
        autoApprove: false,
      },
    ],
  };
}

test("claimNextBatch prefers autoApprove and lower priority", () => {
  const queue = makeQueue();
  const claimed = claimNextBatch(queue, { count: 2, runId: "test-run" });
  assert.deepEqual(
    claimed.map((company) => company.slug),
    ["alpha", "beta"],
  );
  assert.equal(queue.companies[0].status, "in_progress");
  assert.equal(queue.companies[0].claimedBy, "test-run");
});

test("claimNextBatch customOnly claims non-autoApprove companies", () => {
  const queue = makeQueue();
  const claimed = claimNextBatch(queue, { count: 1, customOnly: true });
  assert.equal(claimed[0].slug, "gamma");
});

test("releaseStaleClaims resets old in_progress rows", () => {
  const queue = makeQueue();
  queue.companies[0].status = "in_progress";
  queue.companies[0].claimedAt = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const released = releaseStaleClaims(queue);
  assert.deepEqual(released, ["alpha"]);
  assert.equal(queue.companies[0].status, "pending");
});

test("completeCompany marks done and clears claim", () => {
  const queue = makeQueue();
  queue.companies[1].status = "in_progress";
  queue.companies[1].claimedAt = new Date().toISOString();
  queue.companies[1].claimedBy = "run-1";
  assert.equal(completeCompany(queue, "beta", { postingsFound: 9 }), true);
  assert.equal(queue.companies[1].status, "done");
  assert.equal(queue.companies[1].postingsFound, 9);
  assert.equal(queue.companies[1].claimedBy, null);
});
