import assert from "node:assert/strict";
import test from "node:test";
import type { CuratedSectorView } from "@/components/alerts/types";
import {
  getFeaturedIndustrySectors,
  partitionIndustrySectorsForAddDialog,
  sortCuratedSectorsForAddDialog,
} from "@/lib/alerts/addable-targets";

function sector(slug: string, label: string, groupLabel = "Industry bundles"): CuratedSectorView {
  return {
    slug,
    label,
    description: `${label} description`,
    groupLabel,
    groupSortOrder: groupLabel === "Industry bundles" ? 10 : 20,
    companies: [],
  };
}

test("sortCuratedSectorsForAddDialog pins featured industries ahead of the rest", () => {
  const sorted = sortCuratedSectorsForAddDialog([
    sector("gaming", "Gaming"),
    sector("quant", "Quant"),
    sector("faang", "FAANG+"),
    sector("fintech", "Fintech"),
    sector("ai-stack", "AI labs"),
  ]);

  assert.deepEqual(
    sorted.map((item) => item.slug),
    ["faang", "quant", "ai-stack", "fintech", "gaming"],
  );
});

test("partitionIndustrySectorsForAddDialog separates popular industries from the rest", () => {
  const sectors = [
    sector("gaming", "Gaming"),
    sector("quant", "Quant"),
    sector("faang", "FAANG+"),
    sector("fintech", "Fintech"),
    sector("data-platforms", "Data platforms"),
  ];

  const { featured, remaining } = partitionIndustrySectorsForAddDialog(sectors, new Set(["faang"]));

  assert.deepEqual(
    featured.map((item) => item.slug),
    ["quant", "fintech", "data-platforms"],
  );
  assert.deepEqual(
    remaining.map((item) => item.slug),
    ["gaming"],
  );
});

test("getFeaturedIndustrySectors skips followed packs", () => {
  const featured = getFeaturedIndustrySectors(
    [sector("faang", "FAANG+"), sector("quant", "Quant")],
    new Set(["quant"]),
  );

  assert.deepEqual(
    featured.map((item) => item.slug),
    ["faang"],
  );
});
