import assert from "node:assert/strict";
import test from "node:test";

import { collectGreenhouseLocationSegments } from "@/lib/scraping/adapters/greenhouse";
import { flattenGreenhouseMetadataValues } from "@/lib/scraping/greenhouse-board";
import type { CompanySourceConfig } from "@/lib/scraping/types";

const CLOUDFLARE_SOURCE: CompanySourceConfig = {
  id: "source-uuid",
  companyId: "company-uuid",
  companySlug: "cloudflare",
  companyName: "Cloudflare",
  sourceType: "greenhouse",
  adapterKey: "cloudflare-greenhouse",
  sourceUrl: "https://boards.greenhouse.io/cloudflare",
  boardToken: "cloudflare",
};

test("flattenGreenhouseMetadataValues handles multi_select arrays", () => {
  assert.deepEqual(flattenGreenhouseMetadataValues(["Austin, US", "Remote"]), [
    "Austin, US",
    "Remote",
  ]);
});

test("collectGreenhouseLocationSegments uses offices and multi_select metadata", () => {
  const segments = collectGreenhouseLocationSegments(
    {
      id: 1,
      title: "Network Engineering Intern (Summer 2026)",
      location: { name: "In-Office" },
      offices: [{ name: "Austin, TX", location: "Austin, TX, United States" }],
      metadata: [{ name: "Job Posting Location", value: ["Austin, US"] }],
    },
    CLOUDFLARE_SOURCE,
  );

  assert.deepEqual(segments, ["Austin, TX, United States", "Austin, US"]);
});
