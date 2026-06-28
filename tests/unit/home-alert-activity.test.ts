import assert from "node:assert/strict";
import test from "node:test";
import { buildHomeAlertActivity } from "../../lib/home/alert-activity.ts";

const companiesById = new Map([
  [
    "c1",
    { id: "c1", slug: "jane-street", name: "Jane Street", website_url: "https://janestreet.com" },
  ],
  [
    "c2",
    { id: "c2", slug: "google", name: "Google", website_url: "https://google.com" },
  ],
]);

test("buildHomeAlertActivity includes direct company subscriptions", () => {
  const rows = buildHomeAlertActivity({
    subscriptions: [{ target_type: "company", target_id: "c2", paused: false }],
    companiesById,
    sectorSlugsByCompanySlug: new Map(),
    alertCountsByCompanyId: new Map(),
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.slug, "google");
  assert.equal(rows[0]?.alertCount, 0);
});

test("buildHomeAlertActivity matches sector subscriptions to emailed companies only", () => {
  const rows = buildHomeAlertActivity({
    subscriptions: [{ target_type: "sector", target_id: "quant", paused: false }],
    companiesById,
    sectorSlugsByCompanySlug: new Map([
      ["jane-street", new Set(["quant"])],
      ["google", new Set(["faang"])],
    ]),
    alertCountsByCompanyId: new Map([
      ["c1", 2],
      ["c2", 0],
    ]),
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.slug, "jane-street");
  assert.equal(rows[0]?.alertCount, 2);
});

test("buildHomeAlertActivity skips paused subscriptions but keeps companies with alert counts", () => {
  const rows = buildHomeAlertActivity({
    subscriptions: [
      { target_type: "company", target_id: "c2", paused: true },
      { target_type: "company", target_id: "c1", paused: false },
    ],
    companiesById,
    sectorSlugsByCompanySlug: new Map(),
    alertCountsByCompanyId: new Map([
      ["c1", 1],
      ["c2", 5],
    ]),
  });

  assert.deepEqual(
    rows.map((row) => row.slug),
    ["google", "jane-street"],
  );
  assert.equal(rows[0]?.alertCount, 5);
});
