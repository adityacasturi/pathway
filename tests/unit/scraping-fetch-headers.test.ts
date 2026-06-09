import assert from "node:assert/strict";
import test from "node:test";
import { atsJsonHeaders } from "../../lib/scraping/adapters/shared.ts";

test("atsJsonHeaders uses browser-like headers for protected careers APIs", () => {
  const headers = atsJsonHeaders() as Record<string, string>;

  assert.equal(headers.accept, "application/json");
  assert.match(headers["user-agent"], /Mozilla\/5\.0/);
  assert.match(headers["accept-language"], /^en-US/);
  assert.equal(headers["sec-fetch-site"], "same-origin");
});
