import assert from "node:assert/strict";
import test from "node:test";
import { errorMessage, logServerEvent } from "../../lib/observability.ts";

test("errorMessage normalizes unknown values", () => {
  assert.equal(errorMessage(new Error("boom")), "boom");
  assert.equal(errorMessage("plain"), "plain");
  assert.equal(errorMessage({}), "Unknown error");
});

test("logServerEvent writes JSON lines without throwing", () => {
  const originalInfo = console.info;
  let captured = "";
  console.info = (line: string) => {
    captured = line;
  };
  try {
    logServerEvent({ level: "info", event: "test.event", message: "hello" });
    const payload = JSON.parse(captured);
    assert.equal(payload.event, "test.event");
    assert.equal(payload.app, "pathway");
  } finally {
    console.info = originalInfo;
  }
});
