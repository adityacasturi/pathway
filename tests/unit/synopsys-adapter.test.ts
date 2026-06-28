import assert from "node:assert/strict";
import test from "node:test";
import { matchesSynopsysBrandScope } from "../../lib/scraping/adapters/synopsys.ts";

test("matchesSynopsysBrandScope excludes Ansys-branded roles from Synopsys catalog", () => {
  assert.equal(
    matchesSynopsysBrandScope(
      { title: "Staff Engineer - Ansys Govt Initiatives", category: null, description: null },
      "synopsys",
    ),
    false,
  );
  assert.equal(
    matchesSynopsysBrandScope(
      { title: "Applications Engineering Intern", category: null, description: null },
      "synopsys",
    ),
    true,
  );
});

test("matchesSynopsysBrandScope keeps Ansys-branded roles for Ansys catalog", () => {
  assert.equal(
    matchesSynopsysBrandScope(
      { title: "Applications Engineering Intern", category: null, description: null },
      "ansys",
    ),
    true,
  );
});
