import assert from "node:assert/strict";
import test from "node:test";
import { isMaintenanceMode } from "../../lib/config/maintenance-mode.ts";

test("maintenance mode is off by default", () => {
  const previous = process.env.MAINTENANCE_MODE;
  delete process.env.MAINTENANCE_MODE;
  try {
    assert.equal(isMaintenanceMode(), false);
  } finally {
    if (previous === undefined) delete process.env.MAINTENANCE_MODE;
    else process.env.MAINTENANCE_MODE = previous;
  }
});

test("maintenance mode is on when MAINTENANCE_MODE=true", () => {
  const previous = process.env.MAINTENANCE_MODE;
  process.env.MAINTENANCE_MODE = "true";
  try {
    assert.equal(isMaintenanceMode(), true);
  } finally {
    if (previous === undefined) delete process.env.MAINTENANCE_MODE;
    else process.env.MAINTENANCE_MODE = previous;
  }
});
