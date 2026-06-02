import assert from "node:assert/strict";
import test from "node:test";
import type { DiscoverIndustryCatalogItem } from "../../lib/discover/catalog.ts";
import {
  compareDiscoverCompaniesByOpenings,
  groupCompaniesByIndustry,
} from "../../lib/discover/industries.ts";
import type { DiscoverCompanyCard } from "../../lib/discover/types.ts";

const CATALOG: DiscoverIndustryCatalogItem[] = [
  {
    slug: "ai-research",
    label: "AI research",
    description: "Foundation-model labs.",
    sortOrder: 10,
  },
  {
    slug: "fintech",
    label: "Fintech",
    description: "Neobanks and APIs.",
    sortOrder: 20,
  },
  {
    slug: "productivity",
    label: "Productivity",
    description: "Work software.",
    sortOrder: 30,
  },
  {
    slug: "enterprise-software",
    label: "Enterprise software",
    description: "B2B SaaS.",
    sortOrder: 40,
  },
];

function card(
  slug: string,
  name: string,
  industry: string,
  industryLabel: string,
  openCount = 0,
): DiscoverCompanyCard {
  return {
    id: slug,
    slug,
    name,
    websiteUrl: null,
    industry,
    industryLabel,
    openCount,
    lastSuccessAt: null,
    lastFailureAt: null,
    logoAssetKey: null,
  };
}

test("compareDiscoverCompaniesByOpenings ranks open before closed", () => {
  assert.ok(
    compareDiscoverCompaniesByOpenings(
      card("stripe", "Stripe", "fintech", "Fintech", 2),
      card("toast", "Toast", "enterprise-software", "Enterprise software", 0),
    ) < 0,
  );
});

test("groupCompaniesByIndustry orders sections from catalog and sorts by openings", () => {
  const sections = groupCompaniesByIndustry(
    [
      card("toast", "Toast", "enterprise-software", "Enterprise software", 0),
      card("stripe", "Stripe", "fintech", "Fintech", 4),
      card("anthropic", "Anthropic", "ai-research", "AI research", 1),
      card("asana", "Asana", "productivity", "Productivity", 0),
      card("zip", "Zip", "productivity", "Productivity", 0),
    ],
    CATALOG,
  );

  assert.deepEqual(
    sections.map((section) => section.industry),
    ["ai-research", "fintech", "productivity", "enterprise-software"],
  );
  assert.equal(sections[0]?.companies[0]?.slug, "anthropic");
  assert.equal(sections[1]?.companies[0]?.slug, "stripe");
  assert.match(sections[2]?.description ?? "", /Work software/i);
});
