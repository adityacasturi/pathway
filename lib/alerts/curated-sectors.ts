export interface CuratedAlertSector {
  slug: string;
  label: string;
  description: string;
  companySlugs: string[];
}

export const CURATED_ALERT_SECTORS: CuratedAlertSector[] = [
  {
    slug: "faang",
    label: "FAANG+",
    description: "Meta, Apple, Amazon, Netflix, Google, Microsoft",
    companySlugs: ["meta", "apple", "amazon", "netflix", "google", "microsoft"],
  },
  {
    slug: "ai-stack",
    label: "AI labs",
    description: "OpenAI, Anthropic, Scale, and frontier model shops",
    companySlugs: ["openai", "anthropic", "xai", "cohere", "mistral", "scale-ai", "perplexity"],
  },
  {
    slug: "quant",
    label: "Quant",
    description: "Jane Street, Citadel, HRT, Two Sigma, and peers",
    companySlugs: [
      "jane-street",
      "citadel",
      "hudson-river-trading",
      "two-sigma",
      "de-shaw",
      "optiver",
      "sig",
      "five-rings",
    ],
  },
  {
    slug: "semis",
    label: "Semis",
    description: "NVIDIA, AMD, Qualcomm, Intel, and chip leaders",
    companySlugs: ["nvidia", "amd", "qualcomm", "intel", "broadcom", "micron"],
  },
  {
    slug: "wall-street",
    label: "Wall Street",
    description: "Goldman, JPMorgan, Morgan Stanley, Citi, Bloomberg",
    companySlugs: [
      "goldman-sachs",
      "jpmorgan-chase",
      "morgan-stanley",
      "citigroup",
      "bloomberg",
    ],
  },
  {
    slug: "autonomous",
    label: "Autonomous & robotics",
    description: "Waymo, Zoox, Aurora, Figure, Tesla, and self-driving stacks",
    companySlugs: [
      "waymo",
      "zoox",
      "nuro",
      "aurora",
      "figure-ai",
      "applied-intuition",
      "tesla",
    ],
  },
  {
    slug: "defense",
    label: "Defense & space",
    description: "Lockheed, Anduril, Palantir, SpaceX, Northrop",
    companySlugs: [
      "lockheed-martin",
      "anduril",
      "palantir",
      "spacex",
      "northrop-grumman",
      "rtx",
    ],
  },
  {
    slug: "unicorns",
    label: "Unicorns",
    description: "Stripe, Databricks, Figma, Notion, Discord, Canva, Rippling",
    companySlugs: ["stripe", "databricks", "figma", "notion", "discord", "canva", "rippling"],
  },
  {
    slug: "cybersecurity",
    label: "Cybersecurity",
    description: "CrowdStrike, Palo Alto Networks, Okta, Wiz, SentinelOne, and security leaders",
    companySlugs: [
      "crowdstrike",
      "palo-alto-networks",
      "okta",
      "wiz",
      "sentinelone",
      "zscaler",
    ],
  },
];

const sectorBySlug = new Map(CURATED_ALERT_SECTORS.map((sector) => [sector.slug, sector]));

const companySlugsBySector = new Map(
  CURATED_ALERT_SECTORS.map((sector) => [sector.slug, new Set(sector.companySlugs)]),
);

export function isCuratedSectorSlug(slug: string): boolean {
  return sectorBySlug.has(slug);
}

export function isCompanyInCuratedSector(sectorSlug: string, companySlug: string): boolean {
  return companySlugsBySector.get(sectorSlug)?.has(companySlug) ?? false;
}

export interface SectorCompanyDisplay {
  slug: string;
  name: string;
  websiteUrl: string | null;
}

export function resolveSectorCompanies(
  sector: CuratedAlertSector,
  companiesBySlug: Map<string, SectorCompanyDisplay>,
): SectorCompanyDisplay[] {
  return sector.companySlugs
    .map((slug) => companiesBySlug.get(slug))
    .filter((company): company is SectorCompanyDisplay => Boolean(company));
}
