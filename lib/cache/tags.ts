/** Shared Next.js cache tags for catalog data (invalidated after scrapes / catalog edits). */
export const CACHE_TAGS = {
  feed: "catalog:feed",
  industries: "catalog:industries",
  companies: "catalog:companies",
  companyLookups: "catalog:company-lookups",
  curatedSectors: "catalog:curated-sectors",
} as const;

/** Scrape cadence is hourly; keep catalog caches warm between runs. */
export const CATALOG_REVALIDATE_SECONDS =
  process.env.NODE_ENV === "development" ? 30 : 300;
