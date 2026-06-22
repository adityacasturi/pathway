import assert from "node:assert/strict";
import test from "node:test";
import type { AlertSubscriptionView } from "@/components/alerts/types";
import { sortAlertSubscriptions } from "@/lib/alerts/subscription-sort";

function sub(
  overrides: Pick<AlertSubscriptionView, "id" | "type" | "label"> &
    Partial<AlertSubscriptionView>,
): AlertSubscriptionView {
  return {
    companyId: null,
    companySlug: null,
    sectorSlug: null,
    websiteUrl: null,
    filterOverride: null,
    paused: false,
    ...overrides,
  };
}

test("sortAlertSubscriptions lists bundles first, then companies, alphabetically within each", () => {
  const sorted = sortAlertSubscriptions([
    sub({ id: "1", type: "company", label: "Zeta Corp", companyId: "z" }),
    sub({ id: "2", type: "sector", label: "Defense", sectorSlug: "defense" }),
    sub({ id: "3", type: "company", label: "Acme", companyId: "a" }),
    sub({ id: "4", type: "sector", label: "AI Labs", sectorSlug: "ai-labs" }),
  ]);

  assert.deepEqual(
    sorted.map((item) => `${item.type}:${item.label}`),
    ["sector:AI Labs", "sector:Defense", "company:Acme", "company:Zeta Corp"],
  );
});
