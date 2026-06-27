import assert from "node:assert/strict";
import test from "node:test";
import { alertSubscriptionTypeLabel } from "@/lib/alerts/subscription-type-label";

test("alertSubscriptionTypeLabel uses user-facing type names", () => {
  assert.equal(alertSubscriptionTypeLabel("company"), "Company");
  assert.equal(alertSubscriptionTypeLabel("sector"), "Industry");
});
