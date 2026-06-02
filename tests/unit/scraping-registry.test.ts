import assert from "node:assert/strict";
import test from "node:test";

import { REGISTERED_SOURCE_TYPES } from "@/lib/scraping/registry";
import { SOURCE_TYPES } from "@/lib/scraping/types";

test("scrape registry covers every declared source type", () => {
  assert.deepEqual([...REGISTERED_SOURCE_TYPES].sort(), [...SOURCE_TYPES].sort());
});
