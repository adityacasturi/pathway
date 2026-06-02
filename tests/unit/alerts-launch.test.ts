import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { isAlertsLaunched } from "../../lib/config/alerts-launch.ts";

describe("isAlertsLaunched", () => {
  const original = process.env.ALERTS_LAUNCHED;

  after(() => {
    if (original === undefined) {
      delete process.env.ALERTS_LAUNCHED;
    } else {
      process.env.ALERTS_LAUNCHED = original;
    }
  });

  it("returns false when unset", () => {
    delete process.env.ALERTS_LAUNCHED;
    assert.equal(isAlertsLaunched(), false);
  });

  it("returns true for common truthy values", () => {
    for (const value of ["true", "1", "yes", "TRUE"]) {
      process.env.ALERTS_LAUNCHED = value;
      assert.equal(isAlertsLaunched(), true, `expected true for ${value}`);
    }
  });

  it("returns false for other values", () => {
    process.env.ALERTS_LAUNCHED = "false";
    assert.equal(isAlertsLaunched(), false);
  });
});
